import { forwardRef, useId } from "react";

export interface GlassCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  /** Renders the mixed state used by "select all" controls. */
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Multi-select control. Use a switch instead when the change applies immediately. */
export const GlassCheckbox = forwardRef<HTMLButtonElement, GlassCheckboxProps>(
  (
    {
      checked,
      onChange,
      label,
      description,
      indeterminate = false,
      disabled = false,
      className = "",
    },
    ref,
  ) => {
    const id = useId();
    const state = indeterminate ? "mixed" : checked;

    return (
      <div className={`glass-checkbox-row ${className}`}>
        <button
          ref={ref}
          id={id}
          type="button"
          role="checkbox"
          aria-checked={state}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`glass-checkbox ${checked || indeterminate ? "glass-checkbox--on" : ""}`}
        >
          <span className="glass-checkbox__mark" aria-hidden="true">
            {indeterminate ? "–" : "✓"}
          </span>
        </button>

        {(label || description) && (
          <label htmlFor={id} className="glass-checkbox__text">
            {label && <span className="glass-checkbox__label">{label}</span>}
            {description && <span className="glass-checkbox__description">{description}</span>}
          </label>
        )}
      </div>
    );
  },
);

GlassCheckbox.displayName = "GlassCheckbox";
