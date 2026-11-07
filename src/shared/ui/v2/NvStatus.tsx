import React from "react";

export type NvStatusTone = "live" | "ended" | "attention" | "neutral";

export interface NvStatusProps {
  tone: NvStatusTone;
  children: React.ReactNode;
  onMedia?: boolean;
  className?: string;
}

/**
 * Inline state marker. Colour carries meaning only:
 * live = a session is running, attention = the user is needed,
 * ended = a session just closed (shown for a beat before it leaves).
 */
export const NvStatus: React.FC<NvStatusProps> = ({
  tone,
  children,
  onMedia = false,
  className = "",
}) => (
  <span
    className={`nv-status nv-status--${tone}${onMedia ? " nv-status--media" : ""} ${className}`}
  >
    {children}
  </span>
);
