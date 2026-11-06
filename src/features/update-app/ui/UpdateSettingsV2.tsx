import React, { useEffect } from "react";
import {
  NvButton,
  NvListRow,
  NvListSection,
  NvStatus,
  NvToast,
  NvToggle,
  useI18n,
  type MessageKey,
} from "@/shared";
import { updateErrorMessage } from "@/features/update-app/model/controller";
import {
  updateController,
  useUpdateNotice,
  useUpdates,
} from "@/features/update-app/model/useUpdates";

const STATUS_KEY: Record<string, MessageKey> = {
  unsupported: "update.status.unsupported",
  idle: "update.status.idle",
  checking: "update.status.checking",
  upToDate: "update.status.upToDate",
  available: "update.status.available",
  downloading: "update.status.downloading",
  ready: "update.status.ready",
  installing: "update.status.installing",
  error: "update.status.error",
};

/** v2 settings section for the update runtime. Same controller as v1, new view. */
export const UpdateSettingsV2: React.FC = () => {
  const view = useUpdates();
  const { t, language, locale } = useI18n();
  const actions = updateController;
  useEffect(() => () => updateController.dismissInstall(), []);

  const state = view.state;
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
  const rawIssue = view.issue || (state?.error ? updateErrorMessage(state.error) : null);
  // The controller writes Korean messages; other languages get the generic line.
  const issue = rawIssue ? (language === "ko" ? rawIssue : t("update.errorGeneric")) : null;
  const percent =
    state?.totalBytes && state.totalBytes > 0
      ? Math.min(100, Math.max(0, Math.floor((state.downloadedBytes / state.totalBytes) * 100)))
      : undefined;
  const mb = (bytes: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 ** 2);
  const version = state?.availableVersion ?? "";
  const statusKey =
    phase === "error" && state?.error?.code === "release_unavailable"
      ? "update.status.waiting"
      : STATUS_KEY[phase ?? "idle"];

  return (
    <NvListSection title={t("update.title")}>
      <NvListRow
        title={t("update.current")}
        value={
          state?.currentVersion
            ? `v${state.currentVersion}`
            : view.initialized
              ? t("update.currentDesktop")
              : t("device.checking")
        }
      />
      <NvListRow
        title={t("update.automatic")}
        description={t("update.automaticHint")}
        control={
          <NvToggle
            label={t("update.automatic")}
            checked={automatic}
            onChange={(enabled) => void actions.setAutomatic(enabled)}
            disabled={
              !view.initialized ||
              !supported ||
              !state?.preferencesReady ||
              saving ||
              phase === "installing"
            }
          />
        }
      />

      <div className="nv-update" role="status" aria-live="polite">
        <p className="nv-update__status">
          {view.initialized ? t(statusKey, { version }) : t("update.status.loading")}
        </p>
        {saving && <p className="nv-update__hint">{t("update.saving")}</p>}
        {view.initialized && supported && !state?.canInstall && (
          <p className="nv-update__hint">{t("update.installerOnly")}</p>
        )}
        {view.initialized && supported && !automatic && (
          <p className="nv-update__hint">{t("update.manualOnly")}</p>
        )}
        {phase === "downloading" && (
          <div className="nv-update__download">
            <div
              className={`nv-progress${percent === undefined ? " is-indeterminate" : ""}`}
              role="progressbar"
              aria-label={t("update.progressLabel")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: percent === undefined ? undefined : `${percent}%` }} />
            </div>
            <span className="nv-update__hint">
              {percent === undefined
                ? t("update.progressUnknown", { done: mb(state?.downloadedBytes ?? 0) })
                : t("update.progress", {
                    done: mb(state?.downloadedBytes ?? 0),
                    total: mb(state?.totalBytes ?? 0),
                    percent,
                  })}
            </span>
          </div>
        )}
        {phase === "ready" && <p className="nv-update__hint">{t("update.readyHint")}</p>}
        {phase === "installing" && <p className="nv-update__hint">{t("update.installingHint")}</p>}
        {(issue || preferenceIssue) && (
          <p className="nv-update__issue" role="alert">
            <NvStatus tone="attention">{issue ?? t("update.errorGeneric")}</NvStatus>
          </p>
        )}
        {state?.notes && (phase === "available" || phase === "ready") && (
          <details className="nv-update__notes">
            <summary>{t("update.notes")}</summary>
            <p>{state.notes}</p>
          </details>
        )}

        <div className="nv-update__actions">
          {preferenceIssue && (
            <NvButton onClick={() => void actions.setAutomatic(automatic)} disabled={saving}>
              {t("update.saveAgain")}
            </NvButton>
          )}
          {!view.initialized && issue && (
            <NvButton onClick={actions.reconnect}>{t("update.reconnect")}</NvButton>
          )}
          {view.initialized && phase !== "ready" && phase !== "installing" && (
            <NvButton onClick={() => void actions.checkNow()} disabled={!supported || busy}>
              {phase === "checking" ? t("update.checkingShort") : t("update.check")}
            </NvButton>
          )}
          {phase === "available" && (
            <NvButton
              variant="primary"
              onClick={() => void actions.downloadNow()}
              disabled={!view.initialized || busy}
            >
              {t("update.download")}
            </NvButton>
          )}
          {(phase === "checking" || phase === "downloading") && (
            <NvButton
              variant="quiet"
              onClick={() => void actions.cancelNow()}
              disabled={!view.initialized || view.pending === "cancel"}
            >
              {view.pending === "cancel" ? t("update.cancelling") : t("common.cancel")}
            </NvButton>
          )}
          {phase === "ready" && !view.confirmVersion && (
            <>
              <NvButton
                variant="primary"
                onClick={actions.requestInstall}
                disabled={!view.initialized || !state?.canInstall || saving || busy}
              >
                {t("update.install")}
              </NvButton>
              <NvButton
                variant="quiet"
                onClick={() => void actions.cancelNow()}
                disabled={!view.initialized || busy}
              >
                {t("update.discard")}
              </NvButton>
            </>
          )}
          {phase === "installing" && (
            <NvButton variant="primary" disabled>
              {t("update.installStarting")}
            </NvButton>
          )}
        </div>

        {view.confirmVersion && phase === "ready" && (
          <div className="nv-update__confirm" role="group" aria-label={t("update.confirmTitle")}>
            <strong>{t("update.confirmTitle")}</strong>
            <p>{t("update.confirmBody")}</p>
            <div className="nv-update__actions">
              <NvButton onClick={actions.dismissInstall} data-autofocus>
                {t("update.later")}
              </NvButton>
              <NvButton
                variant="primary"
                onClick={() => void actions.confirmInstall()}
                disabled={!view.initialized || saving || busy}
              >
                {t("update.installNow")}
              </NvButton>
            </div>
          </div>
        )}
        {view.lastCheckedAt !== null && (
          <p className="nv-update__hint">
            {t("update.lastChecked", {
              time: new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(view.lastCheckedAt),
            })}
          </p>
        )}
      </div>
    </NvListSection>
  );
};

/** Bottom-right notice on the v2 home when an update is available or ready. */
export const UpdateNoticeV2: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const notice = useUpdateNotice();
  const { t } = useI18n();
  if (!notice) return null;
  const ready = notice.startsWith("ready:");
  return (
    <div className="nv-update-notice">
      <NvToast
        tone="attention"
        message={ready ? t("update.noticeReady") : t("update.noticeAvailable")}
        action={
          <NvButton variant="quiet" onClick={onOpen}>
            {t("update.noticeOpen")}
          </NvButton>
        }
      />
    </div>
  );
};
