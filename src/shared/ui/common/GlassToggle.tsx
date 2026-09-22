import React, { forwardRef } from "react";

export interface GlassToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

/** Accessible on/off switch with 48px touch hit area. */
export const GlassToggle = forwardRef<HTMLButtonElement, GlassToggleProps>(
  (
    { checked, onChange, label, description, disabled = false, className = "", id, ...props },
    ref,
  ) => {
    const toggleId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const handleToggle = () => {
      if (!disabled) onChange(!checked);
    };

    return (
      <div className="inline-flex items-center justify-between gap-4 select-none w-full">
        {(label || description) && (
          <label htmlFor={toggleId} onClick={handleToggle} className="flex flex-col cursor-pointer">
            {label && <span className="text-sm font-semibold text-primary">{label}</span>}
            {description && <span className="text-xs text-secondary">{description}</span>}
          </label>
        )}

        <div className="flex items-center justify-center min-h-touch min-w-touch shrink-0">
          <button
            ref={ref}
            id={toggleId}
            role="switch"
            type="button"
            aria-checked={checked}
            disabled={disabled}
            onClick={handleToggle}
            className={`glass-toggle-switch ${checked ? "glass-toggle-switch--checked" : ""} ${className}`}
            {...props}
          >
            <span className="glass-toggle-knob" />
          </button>
        </div>
      </div>
    );
  },
);

GlassToggle.displayName = "GlassToggle";
