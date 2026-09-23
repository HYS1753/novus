import React from "react";

export interface NovusLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Official Novus Logo:
 * Features an architectonic N+V unified monogram accompanied by the lowercase 'novus' wordmark.
 */
export const NovusLogo: React.FC<NovusLogoProps> = ({
  height = 34,
  showWordmark = true,
  className = "",
  ...props
}) => {
  const iconWidth = Math.round(height * 0.95);
  const fontSize = Math.round(height * 0.72);

  return (
    <div
      className={`novus-logo-lockup ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        userSelect: "none",
        color: "var(--color-text-primary)",
      }}
      {...props}
    >
      {/* N+V Combined Monogram */}
      <svg
        width={iconWidth}
        height={height}
        viewBox="0 0 36 38"
        fill="none"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        {/* N-pillars with deep V-vertex */}
        <path
          d="M6 31V7L18 29L30 7V31"
          stroke="currentColor"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Luminous accent core */}
        <circle cx="18" cy="29" r="1.6" fill="currentColor" />
      </svg>

      {/* Modern 'novus' display text */}
      {showWordmark && (
        <span
          className="novus-logo-text"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: `${fontSize}px`,
            fontWeight: 800,
            letterSpacing: "0.06em",
            lineHeight: 1,
            color: "currentColor",
          }}
        >
          novus
        </span>
      )}
    </div>
  );
};
