import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftIcon, CloseIcon } from "../icons";

/** Keeps Tab inside `container`, closes on Escape, restores focus on unmount. */
function useModalFocus(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const first = container?.querySelector<HTMLElement>(
      "[data-autofocus], button:not([disabled]), input, [tabindex='0']",
    );
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [tabindex='0']",
        ),
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previous?.focus?.();
    };
  }, [open, containerRef]);
}

/** Portals into the nearest v2 root so tokens and theme still apply. */
function portalTarget(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-nv-portal]") ?? document.body;
}

export interface NvSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Shows a back arrow instead of close, for nested sub-views. */
  onBack?: () => void;
  closeLabel: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Side sheet for settings and pickers. Opaque; slides in with the fold motion. */
export const NvSheet: React.FC<NvSheetProps> = ({
  open,
  title,
  onClose,
  onBack,
  closeLabel,
  backLabel,
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, panelRef, onBack ?? onClose);
  if (!open) return null;

  return createPortal(
    <div className="nv-overlay nv-overlay--sheet">
      <div className="nv-overlay__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="nv-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-nav-scope
      >
        <header className="nv-sheet__head">
          {onBack ? (
            <button
              type="button"
              className="nv-sheet__icon"
              onClick={onBack}
              aria-label={backLabel ?? closeLabel}
            >
              <ArrowLeftIcon size={22} />
            </button>
          ) : null}
          <h2 className="nv-sheet__title">{title}</h2>
          <button
            type="button"
            className="nv-sheet__icon"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <CloseIcon size={22} />
          </button>
        </header>
        <div className="nv-sheet__body">{children}</div>
        {footer && <footer className="nv-sheet__foot">{footer}</footer>}
      </div>
    </div>,
    portalTarget(),
  );
};

export interface NvDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  actions: React.ReactNode;
}

/** Centered dialog, only for decisions that need protected focus. */
export const NvDialog: React.FC<NvDialogProps> = ({
  open,
  title,
  description,
  onClose,
  children,
  actions,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, panelRef, onClose);
  if (!open) return null;

  return createPortal(
    <div className="nv-overlay nv-overlay--dialog">
      <div className="nv-overlay__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="nv-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-nav-scope
      >
        <h2 className="nv-dialog__title">{title}</h2>
        {description && <p className="nv-dialog__desc">{description}</p>}
        {children && <div className="nv-dialog__body">{children}</div>}
        <div className="nv-dialog__actions">{actions}</div>
      </div>
    </div>,
    portalTarget(),
  );
};
