import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, makeCity } from "./helpers.js";
import { clearWeatherCache, describeWeatherCode } from "../src/services/weatherService.js";

/** An Open-Meteo daily payload covering the given days. */
function openMeteo(days: string[]) {
  return {
    daily: {
      time: days,
      weather_code: days.map((_, i) => (i === 0 ? 0 : 63)),
      temperature_2m_max: days.map(() => 31.6),
      temperature_2m_min: days.map(() => 24.2),
      precipitation_probability_max: days.map((_, i) => (i === 0 ? 5 : 80)),
    },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  clearWeatherCache();
  fetchMock.mockReset();
  // Only Open-Meteo is stubbed; supertest does not go through global fetch.
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/v1/weather", () => {
  it("returns the forecast for a day inside the window", async () => {
    await makeCity({ location: { lat: 15.49, lng: 73.83 } });
    fetchMock.mockResolvedValue(Response.json(openMeteo(["2026-10-01", "2026-10-02"])));

    const response = await request(app())
      .get("/api/v1/weather")
      .query({ city: "goa", date: "2026-10-02" })
      .expect(200);

    expect(response.body.forecast).toEqual({
      available: true,
      date: "2026-10-02",
      condition: "rain",
      summary: "Rain",
      tempMax: 32,
      tempMin: 24,
      precipitationChance: 80,
    });

    const calledWith = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(calledWith.hostname).toBe("api.open-meteo.com");
    expect(calledWith.searchParams.get("latitude")).toBe("15.49");
    expect(calledWith.searchParams.get("timezone")).toBe("auto");
  });

  it("fetches a city's forecast once and serves later days from cache", async () => {
    await makeCity({ location: { lat: 15.49, lng: 73.83 } });
    fetchMock.mockResolvedValue(Response.json(openMeteo(["2026-10-01", "2026-10-02"])));

    for (const date of ["2026-10-01", "2026-10-02", "2026-10-01"]) {
      await request(app()).get("/api/v1/weather").query({ city: "goa", date }).expect(200);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says when a date is beyond the forecast window", async () => {
    await makeCity({ location: { lat: 15.49, lng: 73.83 } });
    fetchMock.mockResolvedValue(Response.json(openMeteo(["2026-10-01"])));

    const response = await request(app())
      .get("/api/v1/weather")
      .query({ city: "goa", date: "2027-03-01" })
      .expect(200);

    expect(response.body.forecast).toEqual({
      available: false,
      date: "2027-03-01",
      reason: "out-of-range",
    });
  });

  it("degrades instead of failing when Open-Meteo is down", async () => {
    await makeCity({ location: { lat: 15.49, lng: 73.83 } });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await request(app())
      .get("/api/v1/weather")
      .query({ city: "goa", date: "2026-10-01" })
      .expect(200);

    expect(response.body.forecast).toMatchObject({ available: false, reason: "unavailable" });
  });

  it("reports a city with no coordinates without calling out", async () => {
    await makeCity();

    const response = await request(app())
      .get("/api/v1/weather")
      .query({ city: "goa", date: "2026-10-01" })
      .expect(200);

    expect(response.body.forecast).toMatchObject({ available: false, reason: "no-location" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s for an unknown city and 400s for a malformed date", async () => {
    await request(app())
      .get("/api/v1/weather")
      .query({ city: "atlantis", date: "2026-10-01" })
      .expect(404);

    await request(app())
      .get("/api/v1/weather")
      .query({ city: "goa", date: "tomorrow" })
      .expect(400);
  });
});

describe("describeWeatherCode", () => {
  it.each([
    [0, "clear"],
    [2, "partly-cloudy"],
    [3, "cloudy"],
    [45, "fog"],
    [53, "drizzle"],
    [65, "rain"],
    [81, "rain"],
    [75, "snow"],
    [96, "thunderstorm"],
  ])("maps WMO code %i to %s", (code, condition) => {
    expect(describeWeatherCode(code).condition).toBe(condition);
  });
});
