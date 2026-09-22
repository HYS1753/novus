import React, { useId, useState } from "react";

export interface GlassTooltipProps {
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  /** Single focusable element the tooltip describes. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  className?: string;
}

/**
 * Short clarification for an icon or truncated label.
 * Opens on hover and on keyboard focus, so it never hides information
 * from users who do not use a pointer.
 */
export const GlassTooltip: React.FC<GlassTooltipProps> = ({
  content,
  placement = "top",
  children,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={`glass-tooltip-anchor ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, { "aria-describedby": open ? tooltipId : undefined })}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`glass-tooltip glass-tooltip--${placement} animate-in motion-fade`}
        >
          {content}
        </span>
      )}
    </span>
  );
};

GlassTooltip.displayName = "GlassTooltip";
