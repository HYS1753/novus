import { useEffect, useRef } from "react";
import { GlassButton, GlassDivider, GlassToggle } from "@/shared";
import {
  updateErrorMessage,
  type UpdateController,
  type UpdateView,
} from "@/features/update-app/model/controller";
import { updateController, useUpdates } from "@/features/update-app/model/useUpdates";

type Actions = Pick<
  UpdateController,
  | "reconnect"
  | "setAutomatic"
  | "checkNow"
  | "downloadNow"
  | "cancelNow"
  | "requestInstall"
  | "dismissInstall"
  | "confirmInstall"
>;
export interface UpdateSettingsViewProps {
  view: UpdateView;
  actions: Actions;
}

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const megabytes = (bytes: number) => number.format(bytes / 1024 ** 2);

export function UpdateSettingsView({ view, actions }: UpdateSettingsViewProps) {
  const state = view.state;
  const later = useRef<HTMLButtonElement>(null);
  const installButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (view.confirmVersion) later.current?.focus();
    else if (wasConfirming.current) installButton.current?.focus();
    wasConfirming.current = !!view.confirmVersion;
  }, [view.confirmVersion]);
  const phase =
    view.pending === "check"
      ? "checking"
      : view.pending === "download"
        ? "downloading"
        : view.pending === "install"
          ? "installing"
          : state?.phase;
  const supported = !!state?.supported;
  const saving = view.savingPreference || !!state?.preferenceSaving;
  const busy =
    !!view.pending || phase === "checking" || phase === "downloading" || phase === "installing";
  const automatic = view.requestedAutomatic ?? state?.automaticEnabled ?? false;
  const preferenceIssue = view.preferenceIssue || state?.preferenceError?.message;
  const issue = view.issue || (state?.error ? updateErrorMessage(state.error) : null);
  const percent =
    state?.totalBytes && state.totalBytes > 0
      ? Math.min(100, Math.max(0, Math.floor((state.downloadedBytes / state.totalBytes) * 100)))
      : undefined;
  const titles = {
    unsupported: "Windows용 Novus에서 사용할 수 있습니다",
    idle: "새로운 업데이트를 확인해 보세요",
    checking: "업데이트 확인 중…",
    upToDate: "최신 버전을 사용 중입니다",
    available: `새 버전 ${state?.availableVersion ?? ""}을 사용할 수 있습니다`,
    downloading: "업데이트 다운로드 중…",
    ready: `버전 ${state?.availableVersion ?? ""} 설치 준비 완료`,
    installing: "설치를 시작하고 있습니다…",
    error:
      state?.error?.code === "release_unavailable"
        ? "공개 업데이트 정보를 기다리고 있습니다"
        : "업데이트를 완료하지 못했습니다",
  };
  const cancelConfirmation = () => {
    actions.dismissInstall();
  };
  return (
    <section className="update-settings" aria-label="소프트웨어 업데이트">
      <GlassDivider label="소프트웨어 업데이트" size="md" />
      <div className="update-settings__card">
        <div className="update-settings__version">
          <span>현재 버전</span>
          <strong>
            {state?.currentVersion
              ? `v${state.currentVersion}`
              : view.initialized
                ? "데스크톱 앱에서 확인"
                : "확인 중"}
          </strong>
        </div>
        <div className="update-settings__automatic">
          <div>
            <label id="automatic-update-label" htmlFor="automatic-update-switch">
              자동 업데이트
            </label>
            <p>새 버전을 자동으로 확인하고 내려받습니다. 설치와 재시작은 직접 선택합니다.</p>
          </div>
          <GlassToggle
            id="automatic-update-switch"
            checked={automatic}
            onChange={(enabled) => void actions.setAutomatic(enabled)}
            disabled={
              !view.initialized ||
              !supported ||
              !state?.preferencesReady ||
              saving ||
              phase === "installing"
            }
            aria-labelledby="automatic-update-label"
            aria-label="자동 업데이트"
          />
        </div>
        {saving && (
          <p className="update-settings__hint" role="status">
            설정을 저장하고 있습니다…
          </p>
        )}
        {preferenceIssue && (
          <div className="update-settings__error" role="alert">
            <p>{preferenceIssue}</p>
            <p>
              설정 저장 실패 시 자동 작업을 중지합니다. 다시 시작하기 전에 설정을 다시 저장해
              주세요.
            </p>
            <GlassButton
              size="sm"
              onClick={() => void actions.setAutomatic(automatic)}
              disabled={saving}
            >
              설정 다시 저장
            </GlassButton>
          </div>
        )}
        <div className="update-settings__status" role="status" aria-live="polite">
          <strong>
            {view.initialized ? titles[phase ?? "idle"] : "업데이트 상태를 불러오는 중…"}
          </strong>
        </div>
        {view.initialized && supported && !state?.canInstall && (
          <p className="update-settings__hint">
            설치 파일로 설치한 Novus에서 자동 업데이트와 설치를 사용할 수 있습니다. 이 실행에서는
            수동 확인과 다운로드가 가능합니다.
          </p>
        )}
        {view.initialized && supported && !automatic && (
          <p className="update-settings__hint">
            자동 확인·다운로드가 꺼져 있습니다. 수동으로 확인하거나 준비된 업데이트를 설치할 수
            있습니다.
          </p>
        )}
        {phase === "downloading" && (
          <div className="update-settings__download">
            <div
              className={`update-progress${percent === undefined ? " update-progress--indeterminate" : ""}`}
              role="progressbar"
              aria-label="업데이트 다운로드 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={percent === undefined ? "다운로드 크기 확인 중" : `${percent}%`}
            >
              <span style={{ width: percent === undefined ? undefined : `${percent}%` }} />
            </div>
            <span aria-hidden="true">
              {megabytes(state?.downloadedBytes ?? 0)}
              {state?.totalBytes ? ` / ${megabytes(state.totalBytes)}` : ""} MB
              {percent === undefined ? " · 전체 크기 확인 중" : ` · ${percent}%`}
            </span>
          </div>
        )}
        {phase === "ready" && (
          <p className="update-settings__hint">
            다운로드와 파일 확인이 끝났습니다. 편한 시간에 설치해 주세요.
          </p>
        )}
        {phase === "installing" && (
          <p className="update-settings__hint">
            곧 Novus가 종료됩니다. 설치 완료 후 다시 시작합니다.
          </p>
        )}
        {issue && (
          <p className="update-settings__error" role="alert">
            {issue}
          </p>
        )}
        {state?.notes && (phase === "available" || phase === "ready") && (
          <details className="update-settings__notes">
            <summary>업데이트 내용</summary>
            <p>{state.notes}</p>
          </details>
        )}
        <div className="update-settings__actions">
          {!view.initialized && issue && (
            <GlassButton onClick={actions.reconnect}>다시 연결</GlassButton>
          )}
          {view.initialized && phase !== "ready" && phase !== "installing" && (
            <GlassButton
              onClick={() => void actions.checkNow()}
              disabled={!supported || busy}
              isLoading={phase === "checking"}
            >
              {phase === "checking" ? "확인 중" : "업데이트 확인"}
            </GlassButton>
          )}
          {phase === "available" && (
            <GlassButton
              variant="primary"
              onClick={() => void actions.downloadNow()}
              disabled={!view.initialized || busy}
            >
              다운로드
            </GlassButton>
          )}
          {(phase === "checking" || phase === "downloading") && (
            <GlassButton
              variant="ghost"
              onClick={() => void actions.cancelNow()}
              disabled={!view.initialized || view.pending === "cancel"}
            >
              {view.pending === "cancel" ? "취소 중…" : "취소"}
            </GlassButton>
          )}
          {phase === "ready" && !view.confirmVersion && (
            <>
              <GlassButton
                ref={installButton}
                variant="primary"
                onClick={actions.requestInstall}
                disabled={!view.initialized || !state?.canInstall || saving || busy}
              >
                설치하고 다시 시작
              </GlassButton>
              <GlassButton
                variant="ghost"
                onClick={() => void actions.cancelNow()}
                disabled={!view.initialized || busy}
              >
                다운로드 삭제
              </GlassButton>
            </>
          )}
          {phase === "installing" && (
            <GlassButton variant="primary" isLoading disabled>
              설치 시작 중
            </GlassButton>
          )}
        </div>
        {view.confirmVersion && phase === "ready" && (
          <div
            className="update-settings__confirm"
            role="group"
            aria-labelledby="update-install-title"
          >
            <strong id="update-install-title">지금 설치하고 다시 시작할까요?</strong>
            <p>Novus가 종료되고 재생 중인 콘텐츠도 멈춥니다. 설치가 끝나면 다시 시작합니다.</p>
            <div className="update-settings__actions">
              <GlassButton ref={later} onClick={cancelConfirmation}>
                나중에
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => void actions.confirmInstall()}
                disabled={!view.initialized || saving || busy}
              >
                지금 설치하고 다시 시작
              </GlassButton>
            </div>
          </div>
        )}
        {view.lastCheckedAt !== null && (
          <p className="update-settings__checked">
            마지막 확인 · {new Date(view.lastCheckedAt).toLocaleString("ko-KR")}
          </p>
        )}
      </div>
    </section>
  );
}
export function UpdateSettings() {
  const view = useUpdates();
  useEffect(() => () => updateController.dismissInstall(), []);
  return <UpdateSettingsView view={view} actions={updateController} />;
}
