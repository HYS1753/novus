import { useEffect, useState } from "react";
import { fetchCurrentWeather, usePreference, type CurrentWeather } from "@/shared";

/** Refresh no more often than this; weather does not change faster on screen. */
const REFRESH_MS = 30 * 60_000;
const CACHE_KEY = "novus.v2.weather-cache";

interface CachedWeather extends CurrentWeather {
  key: string;
  fetchedAt: number;
}

function cityKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function readCache(key: string): CachedWeather | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as CachedWeather | null;
    return cached && cached.key === key ? cached : null;
  } catch {
    return null;
  }
}

export interface HomeWeather extends CurrentWeather {
  city: string;
}

/**
 * Current weather for the city chosen in settings. Returns `null` when no
 * city is set or the network is unavailable, so the UI simply hides it.
 */
export function useWeather(): HomeWeather | null {
  const [city] = usePreference("weatherCity");
  const [weather, setWeather] = useState<CachedWeather | null>(null);

  useEffect(() => {
    if (!city) return;
    const key = cityKey(city.latitude, city.longitude);
    const controller = new AbortController();
    let timer = 0;

    const load = async () => {
      const cached = readCache(key);
      if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) {
        setWeather(cached);
        timer = window.setTimeout(load, REFRESH_MS - (Date.now() - cached.fetchedAt));
        return;
      }
      try {
        const current = await fetchCurrentWeather(city.latitude, city.longitude, controller.signal);
        const next: CachedWeather = { ...current, key, fetchedAt: Date.now() };
        setWeather(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Cache is an optimisation only.
        }
      } catch {
        if (controller.signal.aborted) return;
        // Offline or service error: keep a recent cached value, otherwise hide.
        setWeather(cached ?? null);
      }
      timer = window.setTimeout(load, REFRESH_MS);
    };

    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [city]);

  if (!city || !weather || weather.key !== cityKey(city.latitude, city.longitude)) return null;
  return {
    temperature: weather.temperature,
    condition: weather.condition,
    observedAt: weather.observedAt,
    city: city.name,
  };
}
