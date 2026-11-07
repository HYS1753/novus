import React from "react";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ExternalLinkIcon,
  FolderIcon,
  Forward10Icon,
  FullscreenIcon,
  HomeIcon,
  ImageIcon,
  InfoIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RemoteIcon,
  Replay10Icon,
  SearchIcon,
  SettingsIcon,
  ThemeIcon,
  VideoIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "../icons";

/**
 * Each action's icon moves the way its function does, once, when its
 * button is hovered, focused, or pressed (CSS in v2.css, `[data-motion]`):
 * the magnifier looks around, the gear turns, home bounces, back nudges
 * back, close turns a quarter, refresh spins, and so on.
 */
export type IconMotion =
  | "seek"
  | "gear"
  | "sway"
  | "spin"
  | "bounce"
  | "back"
  | "forward"
  | "up"
  | "turn"
  | "lift"
  | "pop"
  | "wiggle"
  | "expand"
  | "out";

const BY_ICON = new Map<unknown, IconMotion>([
  [SearchIcon, "seek"],
  [SettingsIcon, "gear"],
  [ThemeIcon, "sway"],
  [MoonIcon, "sway"],
  [RefreshIcon, "spin"],
  [HomeIcon, "bounce"],
  [ArrowLeftIcon, "back"],
  [ChevronLeftIcon, "back"],
  [ChevronRightIcon, "forward"],
  [ArrowUpIcon, "up"],
  [CloseIcon, "turn"],
  [FolderIcon, "lift"],
  [ImageIcon, "pop"],
  [VideoIcon, "pop"],
  [PlayIcon, "pop"],
  [PauseIcon, "pop"],
  [InfoIcon, "pop"],
  [RemoteIcon, "wiggle"],
  [FullscreenIcon, "expand"],
  [ExternalLinkIcon, "out"],
  [Replay10Icon, "back"],
  [Forward10Icon, "forward"],
  [VolumeIcon, "pop"],
  [VolumeMuteIcon, "pop"],
]);

/** The motion that fits an icon element, if any. */
export function motionOf(icon: React.ReactNode): IconMotion | undefined {
  return React.isValidElement(icon) ? BY_ICON.get(icon.type) : undefined;
}
