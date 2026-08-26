/**
 * An error we intend the client to see.
 *
 * The error middleware sends `message` verbatim for these, and replaces the
 * message with a generic one for anything else — so an accidental `throw new
 * Error(dbConnectionStringWithPassword)` can never reach a response body.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code ?? defaultCodeFor(status);
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "You need to sign in to do that.") {
    return new AppError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "You do not have access to that.") {
    return new AppError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Not found.") {
    return new AppError(404, message, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new AppError(409, message, "CONFLICT");
  }
}

function defaultCodeFor(status: number): string {
  if (status >= 500) return "INTERNAL_ERROR";
  if (status >= 400) return "REQUEST_ERROR";
  return "OK";
}
