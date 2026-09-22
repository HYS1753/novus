import React from "react";

export interface GlassSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  icon?: React.ReactNode;
  formatValue?: (val: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Touch-friendly continuous value control (volume, brightness, etc.). */
export const GlassSlider: React.FC<GlassSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  icon,
  formatValue = (v) => `${v}%`,
  disabled = false,
  className = "",
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={`flex flex-col gap-2 w-full select-none ${className}`}>
      {(label || icon) && (
        <div className="flex items-center justify-between text-xs font-semibold text-secondary">
          <div className="flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            {label && <span className="uppercase tracking-wider">{label}</span>}
          </div>
          <span className="font-mono">{formatValue(value)}</span>
        </div>
      )}

      <div className="relative flex items-center w-full min-h-touch">
        <div className="glass-slider__track">
          <div className="glass-slider__fill" style={{ width: `${percentage}%` }} />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div
          aria-hidden="true"
          className="glass-slider__thumb-indicator"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

GlassSlider.displayName = "GlassSlider";
