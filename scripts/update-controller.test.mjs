import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpdateController,
  UPDATE_STARTUP_DELAY,
  UPDATE_CHECK_INTERVAL,
} from "../src/features/update-app/model/controller.ts";

const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(initial = {}) {
  let state = {
    automaticEnabled: true,
    preferencesReady: true,
    preferenceSaving: false,
    preferenceError: null,
    supported: true,
    canInstall: true,
    phase: "idle",
    currentVersion: "0.2.0",
    availableVersion: null,
    notes: null,
    downloadedBytes: 0,
    totalBytes: null,
    error: null,
    revision: 0,
    ...initial,
  };
  let listener;
  let now = 100_000;
  let online = true;
  let sequence = 0;
  let disposed = 0;
  const timers = new Map();
  const calls = { checks: [], downloads: [], installs: [], cancels: 0 };
  const update = (change) => {
    state = { ...state, ...change, revision: state.revision + 1 };
    listener?.(state);
    return state;
  };
  const api = {
    getState: async () => state,
    listen: async (callback) => {
      listener = callback;
      return () => {
        disposed++;
        if (listener === callback) listener = undefined;
      };
    },
    setAutomatic: async (enabled) => update({ automaticEnabled: enabled }),
    check: async (automatic) => {
      calls.checks.push(automatic);
      return update({ phase: "upToDate" });
    },
    download: async (version, automatic) => {
      calls.downloads.push({ version, automatic });
      return update({ phase: "ready", downloadedBytes: 100, totalBytes: 100 });
    },
    cancel: async () => {
      calls.cancels++;
      return update({ phase: "idle", availableVersion: null });
    },
    install: async (version) => {
      calls.installs.push(version);
      return update({ phase: "installing" });
    },
  };
  const controller = createUpdateController({
    api,
    now: () => now,
    online: () => online,
    setTimer: (callback, delay) => {
      const id = ++sequence;
      timers.set(id, { due: now + delay, callback });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (;;) {
      const next = [...timers]
        .filter(([, timer]) => timer.due <= target)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    now = target;
    await flush();
  };
  return {
    api,
    controller,
    calls,
    update,
    advance,
    timers,
    emit: (value) => listener?.(value),
    getState: () => state,
    getDisposed: () => disposed,
    setOnline: (value) => {
      online = value;
    },
  };
}

test("automatic startup waits 30 seconds, repeats at six hours, and never installs", async () => {
  const f = fixture();
  const stop = f.controller.start();
  await flush();
  await f.advance(UPDATE_STARTUP_DELAY - 1);
  assert.equal(f.calls.checks.length, 0);
  await f.advance(1);
  assert.deepEqual(f.calls.checks, [true]);
  await f.advance(UPDATE_CHECK_INTERVAL - 1);
  assert.equal(f.calls.checks.length, 1);
  await f.advance(1);
  assert.equal(f.calls.checks.length, 2);
  assert.equal(f.calls.installs.length, 0);
  stop();
  assert.equal(f.timers.size, 0);
  assert.equal(f.getDisposed(), 1);
});

test("OFF and uninstalled builds produce no automatic requests; manual checking still works", async () => {
  for (const initial of [{ automaticEnabled: false }, { canInstall: false }]) {
    const f = fixture(initial);
    const stop = f.controller.start();
    await flush();
    await f.advance(UPDATE_CHECK_INTERVAL * 2);
    assert.equal(f.calls.checks.length, 0);
    await f.controller.checkNow();
    assert.deepEqual(f.calls.checks, [false]);
    stop();
  }
});

test("automatic detection downloads a new version once and requires explicit install confirmation", async () => {
  const f = fixture();
  f.api.check = async (automatic) => {
    f.calls.checks.push(automatic);
    return f.update({ phase: "available", availableVersion: "0.2.1" });
  };
  const stop = f.controller.start();
  await flush();
  await f.advance(UPDATE_STARTUP_DELAY);
  assert.deepEqual(f.calls.downloads, [{ version: "0.2.1", automatic: true }]);
  assert.equal(f.controller.getSnapshot().state.phase, "ready");
  await f.advance(UPDATE_CHECK_INTERVAL);
  assert.equal(f.calls.checks.length, 1);
  assert.equal(f.calls.installs.length, 0);
  f.controller.requestInstall();
  assert.equal(f.controller.getSnapshot().confirmVersion, "0.2.1");
  f.controller.dismissInstall();
  assert.equal(f.calls.installs.length, 0);
  f.controller.requestInstall();
  await f.controller.confirmInstall();
  assert.deepEqual(f.calls.installs, ["0.2.1"]);
  stop();
});

test("OFF during an automatic check prevents a late available reply from starting a download", async () => {
  const f = fixture();
  const pending = deferred();
  f.api.check = () => pending.promise;
  const stop = f.controller.start();
  await flush();
  await f.advance(UPDATE_STARTUP_DELAY);
  await f.controller.setAutomatic(false);
  pending.resolve(f.update({ phase: "available", availableVersion: "0.2.1" }));
  await flush();
  assert.equal(f.calls.downloads.length, 0);
  assert.equal(f.controller.getSnapshot().state.automaticEnabled, false);
  assert.equal(f.timers.size, 0);
  stop();
});

test("out-of-order snapshots cannot undo newer state or revive dismissed install confirmation", async () => {
  const f = fixture({ automaticEnabled: false });
  const stop = f.controller.start();
  await flush();
  const ready = f.update({ phase: "ready", availableVersion: "0.2.1" });
  f.controller.requestInstall();
  f.update({ phase: "idle", availableVersion: null });
  f.emit(ready);
  assert.equal(f.controller.getSnapshot().state.phase, "idle");
  assert.equal(f.controller.getSnapshot().confirmVersion, null);
  await f.controller.confirmInstall();
  assert.equal(f.calls.installs.length, 0);
  stop();
});

test("transport download failures do not cause a rapid automatic retry loop", async () => {
  const f = fixture({ phase: "available", availableVersion: "0.2.1" });
  let attempts = 0;
  f.api.download = async () => {
    attempts++;
    throw { code: "network", message: "offline" };
  };
  const stop = f.controller.start();
  await flush();
  await flush();
  assert.equal(attempts, 1);
  assert.equal(f.controller.getSnapshot().issue, "offline");
  stop();
});

test("preference save failure blocks auto work and preserves an actionable error", async () => {
  const f = fixture();
  f.api.setAutomatic = async () => {
    throw { code: "preferences", message: "save failed" };
  };
  const stop = f.controller.start();
  await flush();
  await f.controller.setAutomatic(false);
  await f.advance(UPDATE_CHECK_INTERVAL);
  assert.equal(f.calls.checks.length, 0);
  assert.equal(f.controller.getSnapshot().preferenceIssue, "save failed");
  stop();
});

test("offline timers wait for a wake event without polling; strict lifecycle cleanup removes listeners", async () => {
  const f = fixture();
  f.setOnline(false);
  const stop = f.controller.start();
  await flush();
  await f.advance(UPDATE_STARTUP_DELAY);
  assert.equal(f.calls.checks.length, 0);
  assert.equal(f.timers.size, 0);
  f.setOnline(true);
  f.controller.wake();
  await flush();
  assert.equal(f.calls.checks.length, 1);
  stop();
  const stopAgain = f.controller.start();
  await flush();
  stopAgain();
  assert.equal(f.getDisposed(), 2);
  assert.equal(f.timers.size, 0);
});

test("manual cancellation prevents duplicate requests and stale download replies from enabling installation", async () => {
  const f = fixture({ automaticEnabled: false, phase: "available", availableVersion: "0.2.1" });
  const pending = deferred();
  f.api.download = () => pending.promise;
  const stop = f.controller.start();
  await flush();
  const downloading = f.controller.downloadNow();
  await f.controller.downloadNow();
  const old = { ...f.getState(), phase: "ready", revision: 0 };
  await f.controller.cancelNow();
  pending.resolve(old);
  await downloading;
  assert.equal(f.controller.getSnapshot().state.phase, "idle");
  f.controller.requestInstall();
  assert.equal(f.controller.getSnapshot().confirmVersion, null);
  stop();
});

test("offline available updates wait for connectivity and never install on wake", async () => {
  const f = fixture({ phase: "available", availableVersion: "0.2.1" });
  f.setOnline(false);
  const stop = f.controller.start();
  await flush();
  await f.advance(UPDATE_STARTUP_DELAY);
  assert.equal(f.calls.downloads.length, 0);
  f.setOnline(true);
  f.controller.wake();
  await flush();
  assert.equal(f.calls.downloads.length, 1);
  assert.equal(f.calls.installs.length, 0);
  stop();
});

test("failed state connection stops automation and reconnect restores manual controls", async () => {
  const f = fixture({ automaticEnabled: false });
  const getState = f.api.getState;
  f.api.getState = async () => {
    throw new Error("transport");
  };
  const stop = f.controller.start();
  await flush();
  assert.equal(f.controller.getSnapshot().initialized, false);
  assert.match(f.controller.getSnapshot().issue, /다시 연결/);
  await f.controller.checkNow();
  assert.equal(f.calls.checks.length, 0);
  f.api.getState = getState;
  f.controller.reconnect();
  await flush();
  assert.equal(f.controller.getSnapshot().initialized, true);
  await f.controller.checkNow();
  assert.deepEqual(f.calls.checks, [false]);
  stop();
  assert.equal(f.getDisposed(), 2);
});
