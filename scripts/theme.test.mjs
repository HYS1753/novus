import test from "node:test";
import assert from "node:assert/strict";
import { loadPreferences, PREFERENCES_STORAGE_KEY } from "../src/shared/lib/preferences.ts";

function fixture(record, legacy = "light") {
  const values = new Map([["novus-theme", legacy]]);
  if (record !== undefined) values.set(PREFERENCES_STORAGE_KEY, record);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("legacy theme migrates and survives a fresh session without deleting the legacy record", () => {
  const storage = fixture();
  assert.equal(loadPreferences(storage).theme, "light");
  storage.values.set("novus-theme", "dark");
  assert.equal(loadPreferences(storage).theme, "light");
  assert.equal(storage.values.get("novus-theme"), "dark");
});

test("explicit V2 themes win over legacy, retaining onboarding and user choices", () => {
  for (const theme of ["system", "light", "dark"]) {
    const saved = { theme, posture: "tv", language: "ja", onboardingDone: true };
    const storage = fixture(JSON.stringify(saved));
    const loaded = loadPreferences(storage);
    for (const [key, value] of Object.entries(saved)) assert.equal(loaded[key], value);
  }
});

test("corrupt or invalid records use safe defaults and still recover a valid legacy theme", () => {
  for (const raw of ["{", "null", "[]", '"text"', '{"theme":"invalid"}']) {
    const loaded = loadPreferences(fixture(raw));
    assert.equal(loaded.theme, "light");
    assert.equal(loaded.onboardingDone, false);
  }
  const loaded = loadPreferences(
    fixture(
      JSON.stringify({
        theme: 1,
        posture: null,
        language: "unknown",
        onboardingDone: "yes",
        ambientFolder: 42,
        ambientDelayMinutes: -1,
        weatherCity: { name: "invalid", latitude: 91, longitude: 0 },
      }),
      "invalid",
    ),
  );
  assert.equal(loaded.theme, "system");
  assert.equal(loaded.posture, "tablet");
  assert.equal(loaded.language, null);
  assert.equal(loaded.onboardingDone, false);
  assert.equal(loaded.ambientFolder, null);
  assert.equal(loaded.ambientDelayMinutes, 10);
  assert.equal(loaded.weatherCity, null);
  assert.equal(loadPreferences(fixture('{"ambientDelayMinutes":100000}')).ambientDelayMinutes, 10);
});

test("unavailable or read-only storage cannot crash migration or lose the legacy value", () => {
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(loadPreferences(blocked).theme, "system");
  assert.equal(loadPreferences().theme, "system");
  const storage = fixture();
  storage.setItem = () => {
    throw Error("quota");
  };
  assert.equal(loadPreferences(storage).theme, "light");
  assert.equal(storage.values.get("novus-theme"), "light");
  assert.equal(storage.values.has(PREFERENCES_STORAGE_KEY), false);
});
