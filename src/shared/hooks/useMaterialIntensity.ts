import { useCallback, useState } from "react";
import {
  applyMaterialIntensity,
  clampMaterialIntensity,
  resolveMaterialIntensity,
  type MaterialIntensity,
} from "../lib/material";

export interface MaterialIntensityControl {
  intensity: MaterialIntensity;
  setIntensity: (next: MaterialIntensity) => void;
}

/**
 * Reads the persisted material intensity and keeps <html> in sync with it.
 * Intended entry point for a future app settings screen.
 */
export function useMaterialIntensity(): MaterialIntensityControl {
  const [intensity, setIntensityState] = useState<MaterialIntensity>(() => {
    const initial = resolveMaterialIntensity();
    applyMaterialIntensity(initial, false);
    return initial;
  });

  const setIntensity = useCallback((next: MaterialIntensity) => {
    const clamped = clampMaterialIntensity(next);
    applyMaterialIntensity(clamped);
    setIntensityState(clamped);
  }, []);

  return { intensity, setIntensity };
}
