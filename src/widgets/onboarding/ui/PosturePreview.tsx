import React, { useId } from "react";
import {
  BUNDLED_AMBIENT_ARTWORK,
  getBundledBrandAssetUrl,
  useI18n,
  type PosturePreference,
} from "@/shared";

export interface PosturePreviewProps {
  mode: PosturePreference;
}

const PLATES = ["netflix", "youtube", "disney", "tving"] as const;

/**
 * Illustrated scene for each viewing mode, built from the product's own
 * assets (the bundled photo and official service plates).
 *
 * TV: a living room at night, seen from behind the sofa; the screen sits
 * 1–2 m away, the UI is large, and focus steps across the services as the
 * remote is pressed. Tablet: the device held in both hands; a denser UI with
 * the rail at thumb reach, and a thumb that taps a service.
 *
 * Only transform and opacity animate. Decorative: the cards carry the text.
 */
export const PosturePreview: React.FC<PosturePreviewProps> = ({ mode }) => {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, "");
  const photo =
    BUNDLED_AMBIENT_ARTWORK.find((art) => art.id === "dawn-sea")?.url ??
    BUNDLED_AMBIENT_ARTWORK[0]?.url ??
    "";
  const plates = PLATES.map((id) => ({ id, url: getBundledBrandAssetUrl(id) ?? "" }));
  const id = (name: string) => `${name}-${uid}`;

  return (
    <figure className="ppv" data-mode={mode}>
      <svg className="ppv__svg" viewBox="0 0 560 380" role="presentation" aria-hidden="true">
        <defs>
          {/* Shared */}
          <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f2b3a" />
            <stop offset="1" stopColor="#221f2b" />
          </linearGradient>
          <linearGradient id={id("floor")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3340" />
            <stop offset="1" stopColor="#17141c" />
          </linearGradient>
          <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f2a27a" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#8a5a7a" stopOpacity="0.14" />
            <stop offset="1" stopColor="#8a5a7a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("scrim")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.78" />
          </linearGradient>
          <linearGradient id={id("sofa")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a5068" />
            <stop offset="1" stopColor="#2a2532" />
          </linearGradient>
          <linearGradient id={id("skin")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e6b796" />
            <stop offset="1" stopColor="#b98266" />
          </linearGradient>
          <radialGradient id={id("bokeh")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffcf9a" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffcf9a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("room")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a2330" />
            <stop offset="1" stopColor="#15131a" />
          </linearGradient>
          <clipPath id={id("tvScreen")}>
            <rect x="318" y="126" width="184" height="104" rx="2" />
          </clipPath>
          <clipPath id={id("tabScreen")}>
            <rect x="-142" y="-88" width="284" height="176" rx="6" />
          </clipPath>
          {plates.map((plate, index) => (
            <clipPath key={plate.id} id={id(`tvPlate${index}`)}>
              <rect x={330 + index * 42} y="200" width="36" height="20" rx="1.5" />
            </clipPath>
          ))}
          {plates.map((plate, index) => (
            <clipPath key={plate.id} id={id(`tabPlate${index}`)}>
              <rect x={-128 + index * 50} y="44" width="44" height="25" rx="1.5" />
            </clipPath>
          ))}
        </defs>

        {/* ================= TV: living room ================= */}
        <g className="ppv__scene ppv__scene--tv">
          <rect width="560" height="380" fill={`url(#${id("wall")})`} />
          {/* wall slats */}
          <g opacity="0.07" stroke="#fff">
            {Array.from({ length: 14 }, (_, i) => (
              <line key={i} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="262" />
            ))}
          </g>
          {/* screen light on the wall */}
          <ellipse
            className="ppv__glow"
            cx="410"
            cy="180"
            rx="210"
            ry="140"
            fill={`url(#${id("glow")})`}
          />
          {/* floor */}
          <path d="M0 262 H560 V380 H0 Z" fill={`url(#${id("floor")})`} />
          <ellipse cx="410" cy="292" rx="150" ry="18" fill="#f2a27a" opacity="0.08" />

          {/* console */}
          <rect x="292" y="250" width="236" height="20" rx="2" fill="#3d3646" />
          <rect x="292" y="250" width="236" height="2" fill="#6b6178" />
          <rect x="304" y="270" width="4" height="14" fill="#1a171f" />
          <rect x="512" y="270" width="4" height="14" fill="#1a171f" />

          {/* TV */}
          <rect x="312" y="120" width="196" height="116" rx="3" fill="#050506" />
          <rect x="404" y="236" width="12" height="14" fill="#0b0b0d" />
          <g clipPath={`url(#${id("tvScreen")})`}>
            <image
              href={photo}
              x="318"
              y="116"
              width="184"
              height="124"
              preserveAspectRatio="xMidYMid slice"
            />
            <rect x="318" y="126" width="184" height="104" fill={`url(#${id("scrim")})`} />
            <text x="330" y="168" className="ppv__tv-title" fontSize="17">
              Netflix
            </text>
            <circle cx="333" cy="180" r="2.4" fill="#ff453a" />
            <rect x="339" y="178" width="40" height="4" rx="2" fill="#fff" opacity="0.75" />
            {plates.map((plate, index) => (
              <g key={plate.id} clipPath={`url(#${id(`tvPlate${index}`)})`}>
                <rect x={330 + index * 42} y="200" width="36" height="20" fill="#000" />
                {plate.url && (
                  <image
                    href={plate.url}
                    x={330 + index * 42}
                    y="200"
                    width="36"
                    height="20"
                    preserveAspectRatio="xMidYMid slice"
                  />
                )}
              </g>
            ))}
            <rect
              className="ppv__focus"
              x="328.5"
              y="198.5"
              width="39"
              height="23"
              rx="2.5"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            />
          </g>

          {/* distance on the floor */}
          <g className="ppv__distance">
            <line
              x1="214"
              y1="318"
              x2="300"
              y2="292"
              stroke="#fff"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              opacity="0.8"
            />
            <line x1="212" y1="312" x2="216" y2="324" stroke="#fff" strokeWidth="1.5" />
            <line x1="298" y1="286" x2="302" y2="298" stroke="#fff" strokeWidth="1.5" />
          </g>
          <g className="ppv__pill" transform="translate(232 270)">
            <rect width="54" height="22" rx="11" fill="#000" opacity="0.6" />
            <text x="27" y="15" className="ppv__pill-text" fontSize="11">
              1–2 m
            </text>
          </g>

          {/* sofa and viewer, from behind */}
          <path
            d="M10 300 Q12 268 46 264 L208 264 Q238 266 240 300 L240 380 L10 380 Z"
            fill={`url(#${id("sofa")})`}
          />
          <path
            d="M10 300 Q12 268 46 264 L208 264 Q238 266 240 300"
            fill="none"
            stroke="#554d5f"
            strokeWidth="1.5"
          />
          <rect x="0" y="318" width="250" height="62" rx="10" fill="#332d3c" />
          <g className="ppv__viewer">
            <path d="M86 268 Q86 234 124 230 Q162 234 162 268 L162 290 L86 290 Z" fill="#1d1922" />
            <circle cx="124" cy="208" r="22" fill="#1a161e" />
            <path d="M104 200 Q110 182 128 184 Q146 188 146 204" fill="#262029" />
            {/* rim light from the screen on the side facing it */}
            <path
              d="M140 192 Q148 202 145 218"
              stroke="#f2a27a"
              strokeOpacity="0.7"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M150 240 Q161 250 162 268"
              stroke="#f2a27a"
              strokeOpacity="0.55"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            {/* remote in the raised hand */}
            <g className="ppv__remote">
              <path
                d="M160 262 Q176 246 186 232"
                stroke="#16131a"
                strokeWidth="11"
                strokeLinecap="round"
                fill="none"
              />
              <rect
                x="182"
                y="214"
                width="9"
                height="22"
                rx="3"
                fill="#2a2630"
                transform="rotate(28 186 225)"
              />
              <circle className="ppv__led" cx="190" cy="214" r="1.8" fill="#ff453a" />
            </g>
          </g>
        </g>

        {/* ================= Tablet: in hand ================= */}
        <g className="ppv__scene ppv__scene--tablet">
          <rect width="560" height="380" fill={`url(#${id("room")})`} />
          <circle cx="90" cy="70" r="70" fill={`url(#${id("bokeh")})`} />
          <circle cx="470" cy="60" r="54" fill={`url(#${id("bokeh")})`} />
          <circle cx="510" cy="300" r="80" fill={`url(#${id("bokeh")})`} opacity="0.6" />

          <g className="ppv__hold">
            <g transform="translate(280 196) rotate(-6)">
              {/* palms behind the device */}
              <path
                d="M-150 -24 C-176 -22 -194 6 -192 46 C-190 82 -172 106 -150 110 Z"
                fill={`url(#${id("skin")})`}
              />
              <path
                d="M-150 -24 C-176 -22 -194 6 -192 46"
                fill="none"
                stroke="#000"
                strokeOpacity="0.18"
                strokeWidth="2"
              />
              <path
                d="M150 -24 C176 -22 194 6 192 46 C190 82 172 106 150 110 Z"
                fill={`url(#${id("skin")})`}
              />
              <path
                d="M150 -24 C176 -22 194 6 192 46"
                fill="none"
                stroke="#000"
                strokeOpacity="0.18"
                strokeWidth="2"
              />

              {/* device */}
              <rect x="-152" y="-98" width="304" height="196" rx="16" fill="#0a0a0b" />
              <rect
                x="-152"
                y="-98"
                width="304"
                height="196"
                rx="16"
                fill="none"
                stroke="#2a2a2e"
                strokeWidth="1.5"
              />
              <g clipPath={`url(#${id("tabScreen")})`}>
                <image
                  href={photo}
                  x="-142"
                  y="-96"
                  width="284"
                  height="192"
                  preserveAspectRatio="xMidYMid slice"
                />
                <rect x="-142" y="-88" width="284" height="176" fill={`url(#${id("scrim")})`} />
                <text x="-120" y="-12" className="ppv__tab-title" fontSize="15">
                  Netflix
                </text>
                <circle cx="-118" cy="-1" r="2" fill="#ff453a" />
                <rect x="-113" y="-2.5" width="34" height="3" rx="1.5" fill="#fff" opacity="0.75" />
                {plates.map((plate, index) => (
                  <g key={plate.id} clipPath={`url(#${id(`tabPlate${index}`)})`}>
                    <rect x={-128 + index * 50} y="44" width="44" height="25" fill="#000" />
                    {plate.url && (
                      <image
                        href={plate.url}
                        x={-128 + index * 50}
                        y="44"
                        width="44"
                        height="25"
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                  </g>
                ))}
                {/* rail at thumb reach, lower right */}
                {[0, 1, 2].map((index) => (
                  <circle
                    key={index}
                    cx="124"
                    cy={20 + index * 20}
                    r="7"
                    fill="#000"
                    fillOpacity="0.45"
                    stroke="#fff"
                    strokeOpacity="0.7"
                  />
                ))}
                <circle className="ppv__ripple" cx="44" cy="56" r="14" fill="#fff" />
              </g>

              {/* thumbs resting on the bezel */}
              <path
                d="M-156 12 C-138 2 -114 4 -104 14 C-97 22 -104 32 -118 33 C-134 34 -148 32 -156 30 Z"
                fill={`url(#${id("skin")})`}
                stroke="#000"
                strokeOpacity="0.15"
              />
              <ellipse cx="-110" cy="20" rx="6" ry="4.5" fill="#f6dccb" opacity="0.8" />
              <g className="ppv__thumb">
                <path
                  d="M156 12 C138 2 114 4 104 14 C97 22 104 32 118 33 C134 34 148 32 156 30 Z"
                  fill={`url(#${id("skin")})`}
                  stroke="#000"
                  strokeOpacity="0.15"
                />
                <ellipse cx="110" cy="20" rx="6" ry="4.5" fill="#f6dccb" opacity="0.8" />
              </g>
            </g>
          </g>

          <g transform="translate(244 340)">
            <rect width="72" height="22" rx="11" fill="#000" opacity="0.55" />
            <text x="36" y="15" className="ppv__pill-text" fontSize="11">
              30–50 cm
            </text>
          </g>
        </g>
      </svg>

      <figcaption className="ppv__caption">
        {mode === "tv" ? t("onboarding.previewTv") : t("onboarding.previewTablet")}
      </figcaption>
    </figure>
  );
};
