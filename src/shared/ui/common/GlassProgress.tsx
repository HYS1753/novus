import React from "react";

export interface GlassProgressProps {
  /** Omit to render the indeterminate state. */
  value?: number;
  max?: number;
  label?: string;
  /** Renders the numeric value beside the label. */
  showValue?: boolean;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

/**
 * Linear progress. Use a determinate bar whenever the endpoint is known —
 * an indeterminate bar tells the user nothing about how long they will wait.
 */
export const GlassProgress: React.FC<GlassProgressProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  tone = "primary",
  className = "",
}) => {
  const isIndeterminate = value === undefined;
  const percent = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`glass-progress ${className}`}>
      {(label || showValue) && (
        <div className="glass-progress__header">
          {label && <span className="glass-progress__label">{label}</span>}
          {showValue && !isIndeterminate && (
            <span className="glass-progress__value">{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        className="glass-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isIndeterminate ? undefined : value}
      >
        <div
          className={`glass-progress__bar glass-progress__bar--${tone} ${
            isIndeterminate ? "glass-progress__bar--indeterminate" : ""
          }`}
          style={isIndeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

GlassProgress.displayName = "GlassProgress";
