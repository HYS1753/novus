import React, { useEffect } from "react";
import { GlassCard } from "./GlassCard";

export interface GlassToastProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  title?: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

const TYPE_LABEL: Record<NonNullable<GlassToastProps["type"]>, string> = {
  info: "INFO",
  success: "OK",
  warning: "WARN",
  error: "ERR",
};

/** Ephemeral system feedback toast with auto-dismiss. */
export const GlassToast: React.FC<GlassToastProps> = ({
  isOpen,
  onClose,
  message,
  title,
  type = "info",
  duration = 3000,
}) => {
  useEffect(() => {
    if (!isOpen || duration <= 0) return;
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 animate-in motion-enter-bottom"
    >
      <GlassCard
        elevation="raised"
        className="flex items-center gap-3.5 px-5 py-3.5 min-w-[300px] max-w-[420px] rounded-squircle-xl"
      >
        <GlassBadgeTone type={type} />
        <div className="flex flex-col flex-1 overflow-hidden">
          {title && (
            <span className="text-xs font-bold uppercase tracking-wider text-accent">{title}</span>
          )}
          <span className="text-sm font-medium text-primary truncate">{message}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="glass-toast-close">
          ✕
        </button>
      </GlassCard>
    </div>
  );
};

function GlassBadgeTone({ type }: { type: NonNullable<GlassToastProps["type"]> }) {
  const variant =
    type === "success"
      ? "primary"
      : type === "warning"
        ? "accent"
        : type === "error"
          ? "outline"
          : "neutral";

  return (
    <span
      className={`glass-badge glass-badge--${variant} glass-badge--sm shrink-0`}
      aria-hidden="true"
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

GlassToast.displayName = "GlassToast";
