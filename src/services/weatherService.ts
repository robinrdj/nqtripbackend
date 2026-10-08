import { City } from "../models/City.js";
import { AppError } from "../utils/AppError.js";

/**
 * Daily forecasts from Open-Meteo (free, no API key).
 *
 * Proxied rather than called from the browser so the forecast is fetched once
 * per city and shared: the whole 16-day window comes back in one request, is
 * cached for an hour, and every trip and booking form in that city reads from
 * the same copy.
 *
 * Weather is decoration, not data a booking depends on — so every failure mode
 * here resolves to `{ available: false }` with a reason, never to an error
 * status the page would have to handle.
 */

export type WeatherCondition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

export type Forecast =
  | {
      available: true;
      date: string;
      condition: WeatherCondition;
      summary: string;
      tempMax: number;
      tempMin: number;
      /** Percent, 0-100. */
      precipitationChance: number | null;
    }
  | {
      available: false;
      date: string;
      reason: "out-of-range" | "no-location" | "unavailable";
    };

interface DailySeries {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: (number | null)[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { expires: number; daily: DailySeries }>();

/** Test hook: each test starts from an empty cache. */
export function clearWeatherCache(): void {
  cache.clear();
}

/** WMO weather interpretation codes, grouped into what a traveller cares about. */
export function describeWeatherCode(code: number): {
  condition: WeatherCondition;
  summary: string;
} {
  if (code === 0) return { condition: "clear", summary: "Clear sky" };
  if (code === 1 || code === 2) return { condition: "partly-cloudy", summary: "Partly cloudy" };
  if (code === 3) return { condition: "cloudy", summary: "Overcast" };
  if (code === 45 || code === 48) return { condition: "fog", summary: "Fog" };
  if (code >= 51 && code <= 57) return { condition: "drizzle", summary: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { condition: "rain", summary: code >= 80 ? "Rain showers" : "Rain" };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { condition: "snow", summary: "Snow" };
  }
  if (code >= 95) return { condition: "thunderstorm", summary: "Thunderstorms" };
  return { condition: "cloudy", summary: "Cloudy" };
}

async function fetchDaily(lat: number, lng: number): Promise<DailySeries> {
  const key = `${lat},${lng}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.daily;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  );
  // The city's own zone, so "the 27th" means the 27th where the trip happens.
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "16");

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}`);

  const body = (await response.json()) as { daily?: DailySeries };
  if (!body.daily?.time) throw new Error("Open-Meteo sent no daily series");

  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, daily: body.daily });
  return body.daily;
}

export async function getForecast(cityId: string, date: string): Promise<Forecast> {
  const city = await City.findById(cityId).lean();
  if (!city) throw AppError.notFound(`We could not find the city "${cityId}".`);

  const location = city.location as { lat: number; lng: number } | undefined;
  if (!location) return { available: false, date, reason: "no-location" };

  let daily: DailySeries;
  try {
    daily = await fetchDaily(location.lat, location.lng);
  } catch (err) {
    console.warn("[weather] forecast unavailable:", (err as Error).message);
    return { available: false, date, reason: "unavailable" };
  }

  // Looking the day up in the returned series, rather than computing the
  // window from our own clock, keeps "today" in the city's zone, not ours.
  const index = daily.time.indexOf(date);
  if (index === -1) return { available: false, date, reason: "out-of-range" };

  const { condition, summary } = describeWeatherCode(daily.weather_code[index] ?? 3);

  return {
    available: true,
    date,
    condition,
    summary,
    tempMax: Math.round(daily.temperature_2m_max[index] ?? 0),
    tempMin: Math.round(daily.temperature_2m_min[index] ?? 0),
    precipitationChance: daily.precipitation_probability_max[index] ?? null,
  };
}
