import React, { useEffect, useRef, useState } from "react";

export interface GlassMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect?: () => void;
}

export interface GlassMenuProps {
  trigger: React.ReactNode;
  items: GlassMenuItem[];
  align?: "start" | "end";
  className?: string;
}

/**
 * Dropdown list of actions anchored to its trigger.
 * Closes on selection, on Escape and on any pointer press outside.
 */
export const GlassMenu: React.FC<GlassMenuProps> = ({
  trigger,
  items,
  align = "start",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (item: GlassMenuItem) => {
    if (item.disabled) return;
    item.onSelect?.();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`glass-menu-anchor ${className}`}>
      <span onClick={() => setOpen((prev) => !prev)} className="glass-menu-trigger">
        {trigger}
      </span>

      {open && (
        <div role="menu" className={`glass-menu glass-menu--${align} animate-in motion-emerge`}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => select(item)}
              className={`glass-menu__item glass-menu__item--${item.tone ?? "default"}`}
            >
              {item.icon && <span className="glass-menu__icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

GlassMenu.displayName = "GlassMenu";
