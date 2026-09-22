import React from "react";

export interface GlassEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** A single next step. Never leave an empty view without one. */
  action?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** Placeholder for a view that has no content yet, or no results. */
export const GlassEmptyState: React.FC<GlassEmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  size = "md",
  className = "",
}) => {
  return (
    <div className={`glass-empty glass-empty--${size} ${className}`}>
      {icon && (
        <span className="glass-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="glass-empty__title">{title}</h3>
      {description && <p className="glass-empty__description">{description}</p>}
      {action && <div className="glass-empty__action">{action}</div>}
    </div>
  );
};

GlassEmptyState.displayName = "GlassEmptyState";
