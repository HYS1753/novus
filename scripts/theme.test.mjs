import test from "node:test";
import assert from "node:assert/strict";
import { THEME_STORAGE_KEY, resolveTheme, persistTheme } from "../src/shared/lib/theme.ts";

test("theme survives a fresh session and missing or invalid preferences use dark default", () => {
  const values = new Map();
  const storage = () => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  assert.equal(resolveTheme(storage()), "dark");
  assert.equal(persistTheme("light", storage()), true);
  assert.equal(resolveTheme(storage()), "light");
  assert.equal(persistTheme("dark", storage()), true);
  assert.equal(resolveTheme(storage()), "dark");
  values.set(THEME_STORAGE_KEY, "invalid");
  assert.equal(resolveTheme(storage()), "dark");
});
test("unavailable web storage cannot crash theme switching or startup", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(resolveTheme(blocked), "dark");
  assert.equal(persistTheme("light", blocked), false);
  assert.equal(resolveTheme(), "dark");
  assert.equal(persistTheme("light"), false);
});
