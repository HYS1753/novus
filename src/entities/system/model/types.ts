import type { DockPosition, RuntimeDeviceProfile } from "@/shared";

export type { DockPosition };

export type DeviceProfile = RuntimeDeviceProfile;

export interface SystemSettings {
  dockPosition: DockPosition;
  materialIntensity: number;
  isDark: boolean;
  autoStart: boolean;
  batteryOptimization: boolean;
}
