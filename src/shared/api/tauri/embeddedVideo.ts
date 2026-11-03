import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../lib/runtime";

export interface VideoBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EmbeddedPlayerSupport {
  platform: string;
  available: boolean;
}

export type EmbeddedPlayerAction =
  | "toggle_pause"
  | "play"
  | "pause"
  | "seek_backward"
  | "seek_forward"
  | "toggle_mute"
  | { seek_to: number }
  | { seek_percent: number }
  | { set_volume: number };

export interface EmbeddedVideoPlaybackState {
  position: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
}

export function getEmbeddedPlayerSupport(): Promise<EmbeddedPlayerSupport> {
  if (!isTauriRuntime()) return Promise.resolve({ platform: "browser", available: false });
  return invoke<EmbeddedPlayerSupport>("get_embedded_player_support");
}

export function openEmbeddedVideo(
  sessionId: string,
  filePath: string,
  bounds: VideoBounds,
): Promise<void> {
  return invoke("open_embedded_video", { sessionId, filePath, bounds });
}

export function updateEmbeddedVideoBounds(sessionId: string, bounds: VideoBounds): Promise<void> {
  return invoke("update_embedded_video_bounds", { sessionId, bounds });
}

export function closeEmbeddedVideo(sessionId: string): Promise<void> {
  return invoke("close_embedded_video", { sessionId });
}

export function controlEmbeddedVideo(
  sessionId: string,
  action: EmbeddedPlayerAction,
): Promise<void> {
  return invoke("control_embedded_video", { sessionId, action });
}

export function getEmbeddedVideoState(sessionId: string): Promise<EmbeddedVideoPlaybackState> {
  if (!isTauriRuntime()) {
    return Promise.resolve({
      position: 0,
      duration: 0,
      paused: false,
      volume: 100,
      muted: false,
    });
  }
  return invoke<EmbeddedVideoPlaybackState>("get_embedded_video_state", { sessionId });
}
