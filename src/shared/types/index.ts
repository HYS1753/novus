export type Platform = "windows" | "macos" | "linux" | "unknown";

export interface SystemMetrics {
  batteryLevel?: number;
  isCharging?: boolean;
  networkOnline: boolean;
}

export interface TouchEventCoordinates {
  x: number;
  y: number;
}
