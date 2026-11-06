/**
 * When each streaming service was last on screen. The page manager keeps the
 * sessions alive; this only records facts the hub observed, so the home
 * caption can say "12분 전 사용" without guessing.
 */
const STORAGE_KEY = "novus.v2.session-activity";

type ActivityMap = Record<string, number>;

let activity: ActivityMap = load();

function load(): ActivityMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActivityMap) : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activity));
  } catch {
    // Memory copy remains authoritative for this session.
  }
}

/** Call when a service is shown and again when the user leaves it. */
export function markSessionUsed(id: string, at: number = Date.now()): void {
  activity = { ...activity, [id]: at };
  persist();
}

export function getSessionLastUsed(id: string): number | undefined {
  return activity[id];
}

/** Most recently used first; ties keep the given order. */
export function sortByLastUsed<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (activity[b.id] ?? 0) - (activity[a.id] ?? 0));
}

/** The most recent service among `ids`, if any was ever used. */
export function getMostRecentSession(ids: string[]): string | undefined {
  let best: string | undefined;
  let bestAt = 0;
  for (const id of ids) {
    const at = activity[id] ?? 0;
    if (at > bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}
