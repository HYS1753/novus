/**
 * Open-Meteo client (no API key). Plain HTTPS from the webview; nothing here
 * touches Tauri IPC. Only the fields the home screen shows are requested.
 */
export type WeatherCondition =
  "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "showers" | "storm";

export interface CurrentWeather {
  temperature: number;
  condition: WeatherCondition;
  /** When Open-Meteo measured it (ms since epoch). */
  observedAt: number;
}

export interface CitySearchResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  /** "대한민국 · 서울특별시" style context line. */
  context: string;
}

/** WMO weather interpretation codes → the nine conditions Novus names. */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || code === 80 || code === 81)
    return code >= 80 ? "showers" : "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 82) return "showers";
  if (code >= 95) return "storm";
  return "cloudy";
}

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<CurrentWeather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    "&current=temperature_2m,weather_code&timezone=auto";
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`weather ${response.status}`);
  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; time?: string };
  };
  const current = data.current;
  if (current?.temperature_2m === undefined || current.weather_code === undefined) {
    throw new Error("weather: missing fields");
  }
  return {
    temperature: current.temperature_2m,
    condition: conditionFromWmo(current.weather_code),
    observedAt: current.time ? Date.parse(current.time) || Date.now() : Date.now(),
  };
}

export async function searchCities(
  query: string,
  language: string,
  signal?: AbortSignal,
): Promise<CitySearchResult[]> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(query.trim())}&count=6&format=json&language=${encodeURIComponent(language)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`geocoding ${response.status}`);
  const data = (await response.json()) as {
    results?: {
      name: string;
      latitude: number;
      longitude: number;
      timezone?: string;
      country?: string;
      admin1?: string;
    }[];
  };
  return (data.results ?? []).map((result) => ({
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    context: [result.country, result.admin1].filter(Boolean).join(" · "),
  }));
}
