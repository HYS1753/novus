import React from "react";

export interface GlassListRowProps {
  label: string;
  description?: string;
  /** Leading slot — usually an icon. */
  leading?: React.ReactNode;
  /** Trailing slot — a control, value or chevron. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One line of a settings or detail list: label, optional description and a
 * trailing control. Rows render as buttons only when they are actionable, so
 * a row that merely hosts a switch stays out of the tab order.
 */
export const GlassListRow: React.FC<GlassListRowProps> = ({
  label,
  description,
  leading,
  trailing,
  onClick,
  disabled = false,
  className = "",
}) => {
  const body = (
    <>
      {leading && <span className="glass-list-row__leading">{leading}</span>}
      <span className="glass-list-row__text">
        <span className="glass-list-row__label">{label}</span>
        {description && <span className="glass-list-row__description">{description}</span>}
      </span>
      {trailing && <span className="glass-list-row__trailing">{trailing}</span>}
    </>
  );

  if (!onClick) {
    return <div className={`glass-list-row ${className}`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`glass-list-row glass-list-row--action ${className}`}
    >
      {body}
    </button>
  );
};

GlassListRow.displayName = "GlassListRow";
