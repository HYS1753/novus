export type DockPosition = "right" | "left" | "bottom";

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
