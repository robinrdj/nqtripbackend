/**
 * Transactional email bodies.
 *
 * Plain template strings with inline styles and table layout, because that is
 * what mail clients render consistently — Gmail strips <style> blocks and
 * Outlook ignores flexbox. Every email also ships a plain-text part.
 *
 * Anything a user typed (their name) goes through `escapeHtml`.
 */

// The web app's brand-600 (oklch 0.63 0.2 42) in hex, which mail clients need.
const BRAND = "#e65000";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(options: { preheader: string; heading: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(options.heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BRAND};padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;">QTrip</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(options.heading)}</h1>
          ${options.body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px;">
          You are receiving this because you made a booking on QTrip.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;">
${rows
  .map(
    ([label, value], i) => `  <tr>
    <td style="padding:10px 14px;color:#6b7280;font-size:14px;${i ? "border-top:1px solid #e5e7eb;" : ""}">${escapeHtml(label)}</td>
    <td style="padding:10px 14px;font-size:14px;font-weight:600;text-align:right;${i ? "border-top:1px solid #e5e7eb;" : ""}">${escapeHtml(value)}</td>
  </tr>`
  )
  .join("\n")}
</table>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(label)}</a>`;
}

export interface BookingEmailData {
  customerName: string;
  adventureName: string;
  cityName?: string;
  dateLabel: string;
  persons: number;
  totalLabel: string;
  reference: string;
  tripsUrl: string;
}

function bookingRows(data: BookingEmailData): [string, string][] {
  return [
    ["Adventure", data.adventureName],
    ...(data.cityName ? ([["City", data.cityName]] as [string, string][]) : []),
    ["Date", data.dateLabel],
    ["Guests", `${data.persons} ${data.persons === 1 ? "person" : "people"}`],
    ["Total", data.totalLabel],
    ["Reference", data.reference],
  ];
}

export function bookingConfirmedEmail(data: BookingEmailData) {
  const subject = `You're booked: ${data.adventureName} on ${data.dateLabel}`;

  const html = layout({
    preheader: `Booking ${data.reference} is confirmed. Your ticket is attached.`,
    heading: "Your adventure is booked",
    body: `
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(data.customerName)},</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">Your spot is confirmed. Your ticket is attached as a PDF. Show its QR code at the meeting point.</p>
      ${detailRows(bookingRows(data))}
      <p style="margin:24px 0 0;">${button(data.tripsUrl, "View my trips")}</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">Plans changed? You can cancel from My Trips any time before the day, and your seats go straight back on sale.</p>`,
  });

  const text = [
    `Hi ${data.customerName},`,
    "",
    "Your adventure is booked. Your ticket is attached as a PDF.",
    "",
    ...bookingRows(data).map(([label, value]) => `${label}: ${value}`),
    "",
    `View or cancel your trips: ${data.tripsUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export function bookingCancelledEmail(data: BookingEmailData) {
  const subject = `Cancelled: ${data.adventureName} on ${data.dateLabel}`;

  const html = layout({
    preheader: `Booking ${data.reference} has been cancelled.`,
    heading: "Your booking is cancelled",
    body: `
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(data.customerName)},</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">As requested, we have cancelled this booking. Its ticket is no longer valid.</p>
      ${detailRows(bookingRows(data))}
      <p style="margin:24px 0 0;">${button(data.tripsUrl, "Find another adventure")}</p>`,
  });

  const text = [
    `Hi ${data.customerName},`,
    "",
    "As requested, we have cancelled this booking. Its ticket is no longer valid.",
    "",
    ...bookingRows(data).map(([label, value]) => `${label}: ${value}`),
    "",
    data.tripsUrl,
  ].join("\n");

  return { subject, html, text };
}
