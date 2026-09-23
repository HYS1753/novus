import type { DockPosition } from "@/shared";

export type { DockPosition };

export interface DeviceProfile {
  name: string;
  model: string;
  lowPowerMode: boolean;
}

export interface SystemSettings {
  dockPosition: DockPosition;
  materialIntensity: number;
  isDark: boolean;
  autoStart: boolean;
  batteryOptimization: boolean;
}
