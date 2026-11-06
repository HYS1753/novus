import React from "react";
import { NvStatus, type NvStatusTone } from "./NvStatus";

export interface NvToastProps {
  message: string;
  tone?: Extract<NvStatusTone, "attention" | "neutral" | "ended">;
  action?: React.ReactNode;
  className?: string;
}

/** Inline notice anchored to the bottom of a screen. Polite live region. */
export const NvToast: React.FC<NvToastProps> = ({
  message,
  tone = "neutral",
  action,
  className = "",
}) => (
  <div className={`nv-toast ${className}`} role="status" aria-live="polite">
    <NvStatus tone={tone}>{message}</NvStatus>
    {action}
  </div>
);

export interface NvEmptyStateProps {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const NvEmptyState: React.FC<NvEmptyStateProps> = ({ title, body, icon, action }) => (
  <div className="nv-empty">
    {icon && (
      <span className="nv-empty__icon" aria-hidden="true">
        {icon}
      </span>
    )}
    <p className="nv-empty__title">{title}</p>
    {body && <p className="nv-empty__body">{body}</p>}
    {action && <div className="nv-empty__action">{action}</div>}
  </div>
);

export interface NvCaptionProps {
  status?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The frame caption over a photo: display title, then a state line, then one
 * line of context, then actions. Nothing sits above the title.
 */
export const NvCaption: React.FC<NvCaptionProps> = ({
  status,
  title,
  subtitle,
  actions,
  className = "",
}) => (
  <div className={`nv-caption nv-on-media ${className}`}>
    <h2 className="nv-caption__title">{title}</h2>
    {status && <p className="nv-caption__status">{status}</p>}
    {subtitle && <p className="nv-caption__sub">{subtitle}</p>}
    {actions && <div className="nv-caption__actions">{actions}</div>}
  </div>
);
