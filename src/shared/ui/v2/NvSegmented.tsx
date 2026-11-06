import React, { useRef } from "react";

export interface NvSegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface NvSegmentedProps<T extends string> {
  label: string;
  options: NvSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Single-choice group. Left/right move the choice, as a native radio group does. */
export function NvSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: NvSegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    // Left/right move the choice; up/down are left to spatial navigation.
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={`nv-segmented ${className}`}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`nv-segmented__option${checked ? " is-checked" : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
