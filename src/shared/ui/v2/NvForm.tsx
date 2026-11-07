import React, { useId } from "react";

export interface NvToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Binary switch. The label is always present for assistive tech. */
export const NvToggle: React.FC<NvToggleProps> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`nv-toggle${checked ? " is-on" : ""}`}
    onClick={() => onChange(!checked)}
  >
    <span className="nv-toggle__track" aria-hidden="true">
      <span className="nv-toggle__thumb" />
    </span>
  </button>
);

export interface NvSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  /** Text shown beside the track, e.g. "35". */
  valueText?: string;
  onChange: (value: number) => void;
}

/** Native range input themed from the ramp; arrow keys adjust the value. */
export const NvSlider: React.FC<NvSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueText,
  onChange,
}) => {
  const fill = ((value - min) / (max - min || 1)) * 100;
  return (
    <span className="nv-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        style={{ "--nv-slider-fill": `${fill}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {valueText && <span className="nv-slider__value nv-numeral">{valueText}</span>}
    </span>
  );
};

export interface NvTextFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  leading?: React.ReactNode;
}

export const NvTextField: React.FC<NvTextFieldProps> = ({
  label,
  hint,
  error,
  value,
  onChange,
  leading,
  className = "",
  ...props
}) => {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`nv-field${error ? " has-error" : ""} ${className}`}>
      <label htmlFor={id} className="nv-field__label">
        {label}
      </label>
      <span className="nv-field__control">
        {leading && (
          <span className="nv-field__leading" aria-hidden="true">
            {leading}
          </span>
        )}
        <input
          id={id}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
      </span>
      {error ? (
        <span id={`${id}-error`} className="nv-field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="nv-field__hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
};
