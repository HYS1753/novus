import React from "react";

export interface IconProps extends React.SVGAttributes<SVGElement> {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Official Netflix curved arched wordmark */
export const NetflixLogo: React.FC<IconProps> = ({
  width = 120,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 111 30"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <path
      d="M105.062 14.28L111 30C107.031 29.74 103.078 29.58 99.11 29.5L95.531 20.88L91.953 29.5C88.078 29.58 84.14 29.74 80.203 30L86.14 14.28L80.609 0H88.547L92.203 9.47L95.859 0H103.797L98.266 14.28H105.062ZM67.094 30C63.266 30 59.438 30.08 55.609 30.16V0H63.547V22.95C64.719 22.92 65.906 22.92 67.094 22.92C70.078 22.92 73.062 23 76.047 23.08V30C73.062 30 70.078 30 67.094 30ZM41.016 30.28C37.188 30.36 33.359 30.45 29.531 30.56V0H48.422V6.78H37.469V11.83H46.797V18.61H37.469V30.34C38.641 30.31 39.828 30.29 41.016 30.28ZM16.297 30.95C12.469 31.09 8.641 31.25 4.812 31.42V0H12.75V23.75C13.922 23.72 15.109 23.7 16.297 23.7C18.688 23.7 21.078 23.74 23.469 23.8V30.69C21.078 30.77 18.688 30.86 16.297 30.95ZM0 0H7.938V31.62C5.281 31.75 2.641 31.89 0 32.04V0Z"
      fill="#E50914"
    />
  </svg>
);

/** Official Disney+ logo with cursive script, arc, and plus */
export const DisneyPlusLogo: React.FC<IconProps> = ({
  width = 110,
  height = 42,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 100 40"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    {/* Iconic glowing cyan arc */}
    <path
      d="M10 32C28 12 68 8 82 22"
      stroke="#45E6FF"
      strokeWidth="2.5"
      strokeLinecap="round"
      opacity="0.95"
    />
    {/* Stylized Disney cursive D & wordmark representation */}
    <path
      d="M16 28C14 28 12 25 12 20C12 14 16 11 22 11C28 11 31 15 31 20C31 26 26 28 20 28M17 11V31"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text
      x="35"
      y="26"
      fill="currentColor"
      fontFamily="sans-serif"
      fontSize="13"
      fontWeight="700"
      letterSpacing="-0.5"
    >
      isney
    </text>
    {/* Bold Plus symbol with diamond star accent */}
    <path d="M84 15V27M78 21H90" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    <path
      d="M84 13L85 15L87 15L85.5 16.5L86 18.5L84 17L82 18.5L82.5 16.5L81 15L83 15Z"
      fill="#45E6FF"
    />
  </svg>
);

/** Official YouTube wordmark logo with red play pill */
export const YouTubeLogo: React.FC<IconProps> = ({
  width = 120,
  height = 32,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 30"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    {/* Red Play Badge */}
    <rect x="0" y="2" width="38" height="26" rx="7" fill="#FF0000" />
    <path d="M15 9L26 15L15 21V9Z" fill="#FFFFFF" />
    {/* "YouTube" bold modern typography */}
    <text
      x="44"
      y="22"
      fill="currentColor"
      fontFamily="'YouTube Sans', Roboto, sans-serif"
      fontSize="19"
      fontWeight="800"
      letterSpacing="-0.04em"
    >
      YouTube
    </text>
  </svg>
);

/** Official TVING bold wordmark with iconic dot circle */
export const TvingLogo: React.FC<IconProps> = ({
  width = 100,
  height = 32,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 100 28"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    {/* Vibrant coral circle dot */}
    <circle cx="9" cy="8" r="4.5" fill="#FF153C" />
    {/* TVING clean typography */}
    <text
      x="18"
      y="22"
      fill="currentColor"
      fontFamily="sans-serif"
      fontSize="20"
      fontWeight="900"
      letterSpacing="-0.02em"
    >
      tving
    </text>
  </svg>
);

/** Official Wavve wordmark with curved blue dynamic wave */
export const WavveLogo: React.FC<IconProps> = ({
  width = 110,
  height = 32,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 28"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    {/* Wavve double wave symbol */}
    <path
      d="M3 10C5 6 9 6 12 11C15 16 19 16 21 11"
      stroke="#004FFF"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <path
      d="M7 16C9 12 13 12 16 17C19 22 23 22 25 17"
      stroke="#38BDF8"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    {/* Wavve wordmark */}
    <text
      x="32"
      y="21"
      fill="currentColor"
      fontFamily="sans-serif"
      fontSize="19"
      fontWeight="800"
      letterSpacing="-0.04em"
    >
      wavve
    </text>
  </svg>
);

/** Google Calendar full logo */
export const GoogleCalendarLogo: React.FC<IconProps> = ({
  width = 120,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <rect x="2" y="2" width="28" height="28" rx="6" fill="#FFFFFF" />
    <path d="M2 10H30V26C30 28.2 28.2 30 26 30H6C3.8 30 2 28.2 2 26V10Z" fill="#E8F0FE" />
    <path d="M2 6C2 3.8 3.8 2 6 2H26C28.2 2 30 3.8 30 6V10H2V6Z" fill="#1A73E8" />
    <text
      x="16"
      y="24"
      fill="#1A73E8"
      fontSize="13"
      fontWeight="800"
      fontFamily="sans-serif"
      textAnchor="middle"
    >
      31
    </text>
    <text x="38" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Calendar
    </text>
  </svg>
);

/** Web Radio broadcast logo */
export const WebRadioLogo: React.FC<IconProps> = ({
  width = 110,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <circle cx="16" cy="16" r="3.5" fill="#E879F9" />
    <path
      d="M10 10C6.5 13.5 6.5 18.5 10 22M22 10C25.5 13.5 25.5 18.5 22 22"
      stroke="#C084FC"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M6 6C0.5 11.5 0.5 20.5 6 26M26 6C31.5 11.5 31.5 20.5 26 26"
      stroke="#A855F7"
      strokeWidth="2.5"
      strokeLinecap="round"
      opacity="0.75"
    />
    <text x="38" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Radio BGM
    </text>
  </svg>
);

/** Digital Photo Frame logo */
export const PhotoFrameLogo: React.FC<IconProps> = ({
  width = 110,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <rect x="4" y="5" width="24" height="22" rx="4" stroke="#34D399" strokeWidth="2.5" />
    <circle cx="11" cy="12" r="2" fill="#34D399" />
    <path
      d="M7 23L13 16L19 22L21 20L25 24"
      stroke="#34D399"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <text x="36" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Gallery
    </text>
  </svg>
);

/** Google Search logo */
export const GoogleSearchLogo: React.FC<IconProps> = ({
  width = 110,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <circle cx="14" cy="14" r="7" stroke="#4285F4" strokeWidth="2.8" />
    <path d="M19 19L26 26" stroke="#EA4335" strokeWidth="3.2" strokeLinecap="round" />
    <text x="36" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Search
    </text>
  </svg>
);

/** Ambient Mode Sleep/Clock logo */
export const AmbientClockLogo: React.FC<IconProps> = ({
  width = 110,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <path
      d="M23 18.5C21.8 23 16.5 25.5 12 24C7.5 22.5 5 17.5 6.5 13C7.5 10 10 7.8 13 7.5C12 9 12 11 12.8 13C14 16 16.8 18 20 18C21 18 22 18.2 23 18.5Z"
      fill="#818CF8"
    />
    <circle cx="21" cy="9" r="1.5" fill="#C7D2FE" />
    <text x="34" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Ambient
    </text>
  </svg>
);

/** Smartphone Remote Logo */
export const PhoneRemoteLogo: React.FC<IconProps> = ({
  width = 110,
  height = 36,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 110 32"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <rect x="8" y="4" width="16" height="24" rx="4" stroke="#10B981" strokeWidth="2.2" />
    <line x1="14" y1="23" x2="18" y2="23" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="11" r="2" fill="#10B981" />
    <text x="32" y="22" fill="currentColor" fontFamily="sans-serif" fontSize="16" fontWeight="700">
      Remote
    </text>
  </svg>
);

/** Official Watcha wordmark with signature magenta-pink tone */
export const WatchaLogo: React.FC<IconProps> = ({
  width = 114,
  height = 34,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 114 30"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <rect x="2" y="2" width="26" height="26" rx="6" fill="#FF0558" />
    <polygon points="11,8 21,15 11,22" fill="#FFFFFF" />
    <text
      x="36"
      y="22"
      fill="currentColor"
      fontFamily="sans-serif"
      fontSize="18"
      fontWeight="900"
      letterSpacing="-0.03em"
    >
      WATCHA
    </text>
  </svg>
);

/** Official Coupang Play logo with cyan-blue play arc */
export const CoupangPlayLogo: React.FC<IconProps> = ({
  width = 124,
  height = 34,
  className = "",
  ...props
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 124 30"
    fill="none"
    className={`inline-block ${className}`}
    {...props}
  >
    <circle cx="15" cy="15" r="13" fill="#00AFFF" />
    <polygon points="12,9 21,15 12,21" fill="#FFFFFF" />
    <text
      x="34"
      y="17"
      fill="currentColor"
      fontFamily="sans-serif"
      fontSize="14"
      fontWeight="800"
      letterSpacing="-0.02em"
    >
      coupang
    </text>
    <text
      x="34"
      y="26"
      fill="#00AFFF"
      fontFamily="sans-serif"
      fontSize="10"
      fontWeight="700"
      letterSpacing="0.04em"
    >
      PLAY
    </text>
  </svg>
);
