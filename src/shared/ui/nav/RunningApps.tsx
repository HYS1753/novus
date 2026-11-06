import { useI18n } from "@/shared/hooks/useI18n";
import { useContext } from "react";
import { getBundledBrandAssetUrl } from "@/shared/lib/brandAssets";
import { RunningAppsContext } from "@/shared/ui/nav/runningAppsContext";

export function RunningApps() {
  const { t } = useI18n();
  const state = useContext(RunningAppsContext);
  if (!state || state.apps.length === 0) return null;
  return (
    <nav className="running-apps" aria-label={t("running.label")}>
      <span className="running-apps__label">
        {t("running.count", { count: state.apps.length })}
      </span>
      <div className="running-apps__list">
        {state.apps.map((app) => {
          const icon = getBundledBrandAssetUrl(app.id);
          const active = state.activeId === app.id;
          return (
            <div className="running-apps__item" key={app.id} data-active={active}>
              <button
                type="button"
                className="running-apps__switch"
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
                {icon ? <img src={icon} alt="" /> : <span>{app.title.slice(0, 2)}</span>}
                <span className="running-apps__dot" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="running-apps__close"
                aria-label={t("running.close", { name: app.title })}
                title={t("running.close", { name: app.title })}
                disabled={state.closingId !== null}
                onClick={() => state.onClose(app.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {state.error && (
        <span role="alert" className="running-apps__error">
          {state.error}
        </span>
      )}
    </nav>
  );
}
