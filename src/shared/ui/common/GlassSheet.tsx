import React, { useEffect } from "react";
import { CloseIcon, MotionIcon } from "../icons";

export interface GlassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: "right" | "bottom";
  width?: number;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Edge-docked panel for secondary flows such as settings or details.
 * Use it instead of a modal when the user should keep seeing the context
 * behind the panel.
 */
export const GlassSheet: React.FC<GlassSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  side = "right",
  width = 400,
  footer,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="glass-sheet-layer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="glass-sheet-backdrop animate-in motion-fade" onClick={onClose} />

      <aside
        className={`glass-sheet glass-sheet--${side} animate-in ${
          side === "right" ? "motion-enter-right" : "motion-enter-bottom"
        }`}
        style={side === "right" ? { width } : undefined}
      >
        {(title || description) && (
          <header className="glass-sheet__header">
            {title && <h2 className="glass-sheet__title">{title}</h2>}
            {description && <p className="glass-sheet__description">{description}</p>}
          </header>
        )}

        <div className="glass-sheet__body">{children}</div>

        {footer && <footer className="glass-sheet__footer">{footer}</footer>}

        <button type="button" className="glass-modal-close" onClick={onClose} aria-label="Close">
          <MotionIcon motion="pop">
            <CloseIcon size={20} />
          </MotionIcon>
        </button>
      </aside>
    </div>
  );
};

GlassSheet.displayName = "GlassSheet";
