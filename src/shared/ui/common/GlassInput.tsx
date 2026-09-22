import React, { forwardRef } from "react";

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

/** Form field with glass surface, focus ring, and validation states. */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, helperText, icon, className = "", id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold tracking-wider text-secondary uppercase"
          >
            {label}
          </label>
        )}

        <div className="glass-input-wrapper">
          {icon && (
            <div className="absolute left-4 text-secondary pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`glass-input-field ${error ? "glass-input-field--error" : ""} ${icon ? "pl-11" : ""} ${className}`}
            {...props}
          />
        </div>

        {error ? (
          <span className="text-xs text-danger font-medium tracking-tight ml-1">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-secondary ml-1">{helperText}</span>
        ) : null}
      </div>
    );
  },
);

GlassInput.displayName = "GlassInput";
