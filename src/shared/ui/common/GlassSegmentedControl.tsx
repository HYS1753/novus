import React from "react";

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

export interface GlassSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

/** Exclusive option group rendered as a segmented control. */
export const GlassSegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className = "",
}: GlassSegmentedControlProps<T>) => {
  return (
    <div role="tablist" className={`glass-segmented ${className}`}>
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button
            key={option.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(option.id)}
            className={`glass-segmented__item ${isSelected ? "glass-segmented__item--active" : ""}`}
          >
            {option.icon && <span>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

GlassSegmentedControl.displayName = "GlassSegmentedControl";
