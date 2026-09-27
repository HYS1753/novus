import React, { useEffect, useState } from "react";
import { DashboardPage, StyleGuidePage } from "@/pages";
import {
  getDeviceProfile,
  isStyleGuidePath,
  isStyleGuideRouteEnabled,
  useMaterialIntensity,
} from "@/shared";
import "./styles/global.css";

export const App: React.FC = () => {
  const [showStyleGuide, setShowStyleGuide] = useState(
    () => isStyleGuideRouteEnabled() && isStyleGuidePath(),
  );

  // Resolves the persisted material intensity and applies it to <html>.
  useMaterialIntensity();

  useEffect(() => {
    // Native profile is collected once at process start and cached for the session.
    void getDeviceProfile().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isStyleGuideRouteEnabled()) return;

    const sync = () => setShowStyleGuide(isStyleGuidePath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <>
      <div className="app-ambient" aria-hidden="true" />
      <div className="app-shell">{showStyleGuide ? <StyleGuidePage /> : <DashboardPage />}</div>
    </>
  );
};
