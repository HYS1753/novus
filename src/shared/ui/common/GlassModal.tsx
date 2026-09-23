import React, { useEffect, useRef } from "react";
import { CloseIcon, MotionIcon } from "../icons";
import { GlassCard } from "./GlassCard";

export interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

/** Accessible dialog with scrim, Escape-to-close, and raised glass panel. */
export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-[380px]",
    md: "max-w-[520px]",
    lg: "max-w-[680px]",
    xl: "max-w-[840px]",
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div aria-hidden="true" onClick={onClose} className="glass-modal-backdrop" />

      <GlassCard
        ref={modalRef}
        elevation="raised"
        className={`glass-modal-panel relative z-10 w-full ${maxWidthClass} p-6 sm:p-8 flex flex-col gap-6 animate-in motion-emerge`}
      >
        {(title || description) && (
          <div className="flex flex-col gap-1 pr-10">
            {title && (
              <h2
                id="modal-title"
                className="text-xl sm:text-2xl font-bold tracking-tight text-primary"
              >
                {title}
              </h2>
            )}
            {description && <p className="text-sm text-secondary leading-relaxed">{description}</p>}
          </div>
        )}

        <button type="button" onClick={onClose} aria-label="닫기" className="glass-modal-close">
          <MotionIcon motion="pop">
            <CloseIcon size={20} />
          </MotionIcon>
        </button>

        <div className="text-sm text-primary leading-relaxed">{children}</div>

        {footer && <div className="flex items-center justify-end gap-3 pt-2">{footer}</div>}
      </GlassCard>
    </div>
  );
};
