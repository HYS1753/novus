import { useI18n } from "@/shared/hooks/useI18n";
import { useContext } from "react";
import { NvBrandArt } from "@/shared/ui/v2/NvServicePlate";
import { CloseIcon } from "@/shared/ui/icons";
import { RunningAppsContext } from "@/shared/ui/nav/runningAppsContext";

/**
 * Multitasking on the rail: each running service as its own 16:9 plate.
 * The one on screen is at full strength with a pill beside it; the others
 * are dimmed and one press away. A round × on each plate ends that session.
 */
export function RunningApps() {
  const { t } = useI18n();
  const state = useContext(RunningAppsContext);
  if (!state || state.apps.length === 0) return <div className="nvd__run nvd__run--empty" />;
  return (
    <nav className="nvd__run" aria-label={t("running.label")}>
      <span className="nvd__run-label">{t("running.count", { count: state.apps.length })}</span>
      <ul className="nvd__run-list">
        {state.apps.map((app) => {
          const active = state.activeId === app.id;
          return (
            <li className="nvd__run-item" key={app.id} data-active={active || undefined}>
              <button
                type="button"
                className="nvd__run-switch"
                aria-label={
                  active
                    ? t("running.current", { name: app.title })
                    : t("running.background", { name: app.title })
                }
                aria-current={active ? "page" : undefined}
                title={app.title}
                disabled={state.closingId === app.id}
                onClick={() => state.onSelect(app.id)}
              >
                <NvBrandArt id={app.id} name={app.title} className="nvd__run-art" />
              </button>
              <button
                type="button"
                className="nvd__run-close"
                aria-label={t("running.close", { name: app.title })}
                title={t("running.close", { name: app.title })}
                disabled={state.closingId !== null}
                onClick={() => state.onClose(app.id)}
              >
                <CloseIcon size={12} />
              </button>
            </li>
          );
        })}
      </ul>
      {state.error && (
        <span role="alert" className="nvd__run-error">
          {state.error}
        </span>
      )}
    </nav>
  );
}
