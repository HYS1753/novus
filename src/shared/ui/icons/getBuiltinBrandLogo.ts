import type React from "react";
import type { IconProps } from "./BrandIcons";
import {
  NetflixLogo,
  YouTubeLogo,
  DisneyPlusLogo,
  TvingLogo,
  WavveLogo,
  WatchaLogo,
  CoupangPlayLogo,
  GoogleCalendarLogo,
  WebRadioLogo,
  PhotoFrameLogo,
  GoogleSearchLogo,
  AmbientClockLogo,
  PhoneRemoteLogo,
} from "./BrandIcons";

/** Builtin vector brand logo lookup helper */
export const getBuiltinBrandLogo = (id: string): React.FC<IconProps> | null => {
  switch (id.toLowerCase()) {
    case "netflix":
      return NetflixLogo;
    case "youtube":
      return YouTubeLogo;
    case "disney":
    case "disneyplus":
      return DisneyPlusLogo;
    case "tving":
      return TvingLogo;
    case "wavve":
      return WavveLogo;
    case "watcha":
      return WatchaLogo;
    case "coupang":
    case "coupangplay":
      return CoupangPlayLogo;
    case "calendar":
      return GoogleCalendarLogo;
    case "radio":
      return WebRadioLogo;
    case "photos":
      return PhotoFrameLogo;
    case "browser":
    case "search":
      return GoogleSearchLogo;
    case "ambient":
      return AmbientClockLogo;
    case "remote":
      return PhoneRemoteLogo;
    default:
      return null;
  }
};
