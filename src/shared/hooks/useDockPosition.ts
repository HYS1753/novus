import { useState, useEffect, useCallback } from "react";
import type { DockPosition } from "../types";

const DOCK_POSITION_STORAGE_KEY = "novus-dock-position";
const DOCK_POSITION_EVENT = "novus-dock-position-changed";

function getStoredDockPosition(): DockPosition {
  if (typeof window === "undefined") return "right";
  try {
    const stored = localStorage.getItem(DOCK_POSITION_STORAGE_KEY);
    if (stored === "right" || stored === "left" || stored === "bottom") {
      return stored;
    }
  } catch {
    // fallback if localStorage is disabled or restricted
  }
  return "right";
}

export function useDockPosition() {
  const [dockPosition, setDockPositionState] = useState<DockPosition>(getStoredDockPosition);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DOCK_POSITION_STORAGE_KEY && event.newValue) {
        if (
          event.newValue === "right" ||
          event.newValue === "left" ||
          event.newValue === "bottom"
        ) {
          setDockPositionState(event.newValue as DockPosition);
        }
      }
    };

    const handleCustom = (event: Event) => {
      const customEvent = event as CustomEvent<DockPosition>;
      if (customEvent.detail) {
        setDockPositionState(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(DOCK_POSITION_EVENT, handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(DOCK_POSITION_EVENT, handleCustom);
    };
  }, []);

  const setDockPosition = useCallback((next: DockPosition) => {
    setDockPositionState(next);
    try {
      localStorage.setItem(DOCK_POSITION_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<DockPosition>(DOCK_POSITION_EVENT, { detail: next }));
    }
  }, []);

  return { dockPosition, setDockPosition };
}
