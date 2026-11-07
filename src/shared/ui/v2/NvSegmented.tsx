import React, { useLayoutEffect, useRef, useState } from "react";

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

/**
 * Single-choice group with a sliding selection, as on a phone: tap an
 * option, or press and drag the selection across them and let go where it
 * should land. Left/right move the choice, as a native radio group does.
 */
export function NvSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: NvSegmentedProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  // Where the selection sits while a finger drags it (null when at rest).
  const [preview, setPreview] = useState<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const pointer = useRef<{ id: number; moved: boolean } | null>(null);
  const handledByPointer = useRef(false);
  const shown = preview ?? selected;

  // The thumb follows the shown option's box (labels differ in width).
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const place = () => {
      const button = refs.current[shown];
      if (button) setThumb({ left: button.offsetLeft, width: button.offsetWidth });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [shown, options.length]);

  const indexAt = (clientX: number) => {
    let nearest = 0;
    let best = Infinity;
    refs.current.forEach((button, index) => {
      if (!button) return;
      const box = button.getBoundingClientRect();
      const distance =
        clientX < box.left ? box.left - clientX : clientX > box.right ? clientX - box.right : 0;
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer.current = { id: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
    setPreview(indexAt(event.clientX));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current.moved = true;
    setPreview(indexAt(event.clientX));
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setPressed(false);
    const landed = indexAt(event.clientX);
    setPreview(null);
    if (!commit) return;
    handledByPointer.current = true;
    if (options[landed] && options[landed].value !== value) onChange(options[landed].value);
    refs.current[landed]?.focus({ preventScroll: true });
  };

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
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={`nv-segmented ${className}`}
      data-pressed={pressed || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, false)}
    >
      <span
        className="nv-segmented__thumb"
        aria-hidden="true"
        style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
      />
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
            className={`nv-segmented__option${index === shown ? " is-checked" : ""}`}
            onClick={() => {
              // A press already chose on release; this click is the keyboard's (Enter/Space).
              if (handledByPointer.current) {
                handledByPointer.current = false;
                return;
              }
              onChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
