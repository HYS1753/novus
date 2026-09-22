import React from "react";

export interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}) => {
  return (
    <button
      className={`touch-button touch-button--${variant} touch-button--${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
