import React, { useCallback, useEffect, useRef, useState } from "react";

export interface NvMenuProps {
  label: string;
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
}

/**
 * A small anchored menu (sort, location, …): opens under its trigger,
 * moves focus to the chosen entry, closes on an outside press or Escape,
 * and hands focus back to the trigger.
 */
export const NvMenu: React.FC<NvMenuProps> = ({ label, trigger, children, align = "start" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Opening moves focus to the chosen entry (or the first); closing returns it.
  useEffect(() => {
    if (!open) return;
    const panel = ref.current?.querySelector<HTMLElement>("[role=menu]");
    (
      panel?.querySelector<HTMLElement>("[aria-checked=true]") ??
      panel?.querySelector<HTMLElement>("button")
    )?.focus();
  }, [open]);
  // Found by state, not by ref: the open menu's trigger is the expanded one.
  const close = useCallback(() => {
    const trigger = document.querySelector<HTMLElement>(
      ".nv-menu [data-menu-trigger][aria-expanded='true']",
    );
    setOpen(false);
    trigger?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        ref.current?.querySelector<HTMLElement>("[data-menu-trigger]")?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div className="nv-menu" ref={ref}>
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div className={`nv-menu__panel nv-menu__panel--${align}`} role="menu" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
};
