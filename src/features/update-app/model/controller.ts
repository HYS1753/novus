import type { UpdateState, UpdateFailure } from "@/shared";

export const UPDATE_STARTUP_DELAY = 30_000;
export const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
type Action = "check" | "download" | "cancel" | "install";
export interface UpdateView {
  state: UpdateState | null;
  initialized: boolean;
  pending: Action | null;
  savingPreference: boolean;
  requestedAutomatic: boolean | null;
  issue: string | null;
  preferenceIssue: string | null;
  confirmVersion: string | null;
  lastCheckedAt: number | null;
}
export interface UpdateDependencies {
  api: {
    getState(): Promise<UpdateState>;
    listen(callback: (state: UpdateState) => void): Promise<() => void>;
    setAutomatic(enabled: boolean): Promise<UpdateState>;
    check(automatic: boolean): Promise<UpdateState>;
    download(version: string, automatic: boolean): Promise<UpdateState>;
    cancel(): Promise<UpdateState>;
    install(version: string): Promise<UpdateState>;
  };
  now(): number;
  online(): boolean;
  setTimer(callback: () => void, delay: number): unknown;
  clearTimer(handle: unknown): void;
}
export function updateErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const failure = error as UpdateFailure;
    if (failure.code === "release_unavailable")
      return "아직 공개된 업데이트 정보를 확인할 수 없습니다. 나중에 다시 확인해 주세요.";
    if (typeof failure.message === "string") return failure.message;
  }
  return "업데이트 작업을 완료하지 못했습니다. 다시 시도해 주세요.";
}
const busyPhase = (phase: UpdateState["phase"] | undefined) =>
  phase === "checking" || phase === "downloading" || phase === "installing";

/** One main-webview owner; settings subscribers do not own tasks or timers. */
export function createUpdateController(deps: UpdateDependencies) {
  let view: UpdateView = {
    state: null,
    initialized: false,
    pending: null,
    savingPreference: false,
    requestedAutomatic: null,
    issue: null,
    preferenceIssue: null,
    confirmVersion: null,
    lastCheckedAt: null,
  };
  const subscribers = new Set<() => void>();
  let running = false;
  let epoch = 0;
  let serial = 0;
  let active: { id: number; kind: Action } | null = null;
  let dispose: (() => void) | undefined;
  let timer: unknown;
  let nextDue: number | null = null;
  let connection = 0;
  let autoDownloadAttempted: string | null = null;

  function publish(change: Partial<UpdateView>) {
    view = { ...view, ...change };
    for (const callback of subscribers) callback();
  }
  function eligible() {
    const state = view.state;
    return (
      running &&
      view.initialized &&
      state?.supported &&
      state.canInstall &&
      state.preferencesReady &&
      state.automaticEnabled &&
      !state.preferenceSaving &&
      !view.savingPreference &&
      view.requestedAutomatic !== false &&
      !view.preferenceIssue &&
      !state.preferenceError
    );
  }
  function clearTimer() {
    if (timer !== undefined) deps.clearTimer(timer);
    timer = undefined;
  }
  function schedule() {
    if (!eligible()) {
      clearTimer();
      nextDue = null;
      return;
    }
    if (nextDue === null) nextDue = deps.now() + UPDATE_STARTUP_DELAY;
    if (timer === undefined && nextDue > deps.now()) {
      timer = deps.setTimer(() => {
        timer = undefined;
        wake();
      }, nextDue - deps.now());
    }
  }
  function accept(state: UpdateState) {
    if (!running || (view.state && state.revision <= view.state.revision)) return;
    const confirmationValid =
      state.phase === "ready" && state.canInstall && state.availableVersion === view.confirmVersion;
    publish({ state, confirmVersion: confirmationValid ? view.confirmVersion : null });
    schedule();
    queueMicrotask(maybeDownload);
  }
  function maybeDownload() {
    if (!eligible() || !deps.online() || active || busyPhase(view.state?.phase)) return;
    if (
      view.state?.phase === "available" &&
      view.state.availableVersion &&
      autoDownloadAttempted !== view.state.availableVersion
    ) {
      autoDownloadAttempted = view.state.availableVersion;
      void run("download", () => deps.api.download(view.state!.availableVersion!, true));
    }
  }
  function wake() {
    if (!eligible() || nextDue === null || deps.now() < nextDue || !deps.online()) return;
    clearTimer();
    nextDue = deps.now() + UPDATE_CHECK_INTERVAL;
    schedule();
    if (!active && ["idle", "upToDate", "error"].includes(view.state!.phase)) {
      void run("check", () => deps.api.check(true));
    } else maybeDownload();
  }
  async function refresh() {
    try {
      accept(await deps.api.getState());
    } catch {
      publish({
        initialized: false,
        issue: "업데이트 상태를 불러오지 못했습니다. 다시 연결해 주세요.",
      });
      schedule();
    }
  }
  async function run(kind: Action, action: () => Promise<UpdateState>) {
    if (!running || !view.initialized || !view.state?.supported) return;
    if (kind !== "cancel" && (active || busyPhase(view.state.phase))) return;
    const id = ++serial;
    const lifecycle = epoch;
    active = { id, kind };
    if (kind === "check") autoDownloadAttempted = null;
    if (kind === "download") autoDownloadAttempted = view.state.availableVersion;
    publish({ pending: kind, issue: null, confirmVersion: null });
    if (kind === "check" && eligible()) {
      clearTimer();
      nextDue = deps.now() + UPDATE_CHECK_INTERVAL;
      schedule();
    }
    try {
      const state = await action();
      if (!running || lifecycle !== epoch) return;
      accept(state);
      if (
        active?.id === id &&
        kind === "check" &&
        (state.phase === "upToDate" || state.phase === "available")
      )
        publish({ lastCheckedAt: deps.now() });
    } catch (error) {
      if (!running || lifecycle !== epoch || active?.id !== id) return;
      const code = (error as Partial<UpdateFailure> | null)?.code;
      if (code !== "cancelled" && code !== "busy") publish({ issue: updateErrorMessage(error) });
      await refresh();
    } finally {
      if (running && lifecycle === epoch && active?.id === id) {
        active = null;
        publish({ pending: null });
        schedule();
        queueMicrotask(maybeDownload);
      }
    }
  }
  async function bootstrap(lifecycle: number) {
    const attempt = ++connection;
    try {
      const unlisten = await deps.api.listen(accept);
      if (!running || lifecycle !== epoch || attempt !== connection) {
        unlisten();
        return;
      }
      dispose = unlisten;
      const state = await deps.api.getState();
      if (!running || lifecycle !== epoch || attempt !== connection) return;
      accept(state);
      publish({ initialized: true, issue: null });
      schedule();
      queueMicrotask(maybeDownload);
    } catch (error) {
      if (running && lifecycle === epoch && attempt === connection)
        publish({
          initialized: false,
          issue:
            "업데이트 상태를 불러오지 못했습니다. 다시 연결해 주세요. " + updateErrorMessage(error),
        });
    }
  }
  function start() {
    if (running) return () => {};
    running = true;
    const lifecycle = ++epoch;
    void bootstrap(lifecycle);
    return () => {
      if (lifecycle !== epoch) return;
      running = false;
      epoch++;
      connection++;
      serial++;
      active = null;
      dispose?.();
      dispose = undefined;
      clearTimer();
      nextDue = null;
      publish({ pending: null, confirmVersion: null });
    };
  }
  async function setAutomatic(enabled: boolean) {
    if (
      !running ||
      !view.state?.supported ||
      view.savingPreference ||
      view.state.preferenceSaving ||
      view.state.phase === "installing"
    )
      return;
    const lifecycle = epoch;
    publish({ savingPreference: true, requestedAutomatic: enabled, preferenceIssue: null });
    schedule();
    try {
      const state = await deps.api.setAutomatic(enabled);
      if (running && lifecycle === epoch) {
        if (enabled) autoDownloadAttempted = null;
        accept(state);
      }
    } catch (error) {
      if (running && lifecycle === epoch) {
        publish({ preferenceIssue: updateErrorMessage(error) });
        await refresh();
      }
    } finally {
      if (running && lifecycle === epoch) {
        publish({ savingPreference: false, requestedAutomatic: null });
        schedule();
        queueMicrotask(maybeDownload);
      }
    }
  }
  return {
    subscribe(callback: () => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    getSnapshot: () => view,
    start,
    wake,
    reconnect() {
      if (!running) return;
      dispose?.();
      dispose = undefined;
      publish({ initialized: false, issue: null });
      schedule();
      void bootstrap(epoch);
    },
    setAutomatic,
    checkNow: () => run("check", () => deps.api.check(false)),
    downloadNow() {
      const version = view.state?.availableVersion;
      if (view.state?.phase === "available" && version)
        return run("download", () => deps.api.download(version, false));
    },
    cancelNow() {
      if (view.pending !== "install" && view.state?.phase !== "installing")
        return run("cancel", deps.api.cancel);
    },
    requestInstall() {
      const state = view.state;
      if (
        view.initialized &&
        !active &&
        state?.phase === "ready" &&
        state.canInstall &&
        !view.savingPreference &&
        !state.preferenceSaving
      )
        publish({ confirmVersion: state.availableVersion });
    },
    dismissInstall() {
      if (view.confirmVersion) publish({ confirmVersion: null });
    },
    confirmInstall() {
      const version = view.confirmVersion;
      if (
        view.initialized &&
        version &&
        view.state?.phase === "ready" &&
        view.state.canInstall &&
        view.state.availableVersion === version &&
        !view.savingPreference &&
        !view.state.preferenceSaving
      )
        return run("install", () => deps.api.install(version));
      publish({
        confirmVersion: null,
        issue: "업데이트 상태가 변경되었습니다. 다시 확인해 주세요.",
      });
    },
  };
}
export type UpdateController = ReturnType<typeof createUpdateController>;
