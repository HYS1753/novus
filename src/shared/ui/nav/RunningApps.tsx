import { useContext } from "react";
import { getBundledBrandAssetUrl } from "@/shared/lib/brandAssets";
import { RunningAppsContext } from "@/shared/ui/nav/runningAppsContext";

export function RunningApps() {
  const state = useContext(RunningAppsContext);
  if (!state || state.apps.length === 0) return null;
  return (
    <nav className="running-apps" aria-label="실행 중인 앱">
      <span className="running-apps__label">실행 중 {state.apps.length}</span>
      <div className="running-apps__list">
        {state.apps.map((app) => {
          const icon = getBundledBrandAssetUrl(app.id);
          const active = state.activeId === app.id;
          return (
            <div className="running-apps__item" key={app.id} data-active={active}>
              <button
                type="button"
                className="running-apps__switch"
                aria-label={`${app.title} ${active ? "현재 앱" : "백그라운드 실행 중, 열기"}`}
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
                aria-label={`${app.title} 닫기`}
                title={`${app.title} 닫기`}
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
