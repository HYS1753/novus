import React, { useEffect, useState } from "react";
import {
  BUNDLED_AMBIENT_ARTWORK,
  NvBrandArt,
  NovusLogo,
  useI18n,
  type PosturePreference,
} from "@/shared";
import { ALL_APPS } from "@/entities";
import "./posture-preview.css";

export interface PosturePreviewProps {
  mode: PosturePreference;
}

const SERVICES = ["netflix", "youtube", "disney", "tving", "wavve"] as const;
const TABLET_TILES = [
  "netflix",
  "youtube",
  "disney",
  "tving",
  "wavve",
  "watcha",
  "coupang",
] as const;

/** One beat of the film: short enough to read as motion, long enough to follow. */
const BEAT_MS = 1100;

function service(id: string) {
  const app = ALL_APPS.find((entry) => entry.id === id);
  return { id, title: app?.title ?? id, accent: app?.accentColor ?? "#ffffff" };
}

function useReducedMotion(): boolean {
  const [reduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  return reduced;
}

/** Advances a looping storyboard while its scene is on screen; idle otherwise. */
function useBeat(active: boolean, beats: number): number {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const id = window.setInterval(() => setBeat((value) => (value + 1) % beats), BEAT_MS);
    return () => window.clearInterval(id);
  }, [active, beats, reduced]);
  return active ? beat : 0;
}

/** The launch screen in miniature: the plate over a bloom of its own art. */
const MiniLoader: React.FC<{ id: string; title: string; accent: string; open: boolean }> = ({
  id,
  title,
  accent,
  open,
}) => (
  <div className="ppv-loader" data-open={open || undefined}>
    <div className="ppv-loader__media">
      <span className="ppv-loader__glow" aria-hidden="true" style={{ color: accent }} />
      <NvBrandArt id={id} name={title} className="ppv-loader__art" />
    </div>
    <span className="ppv-loader__title">{title}</span>
  </div>
);

/* ------------------------------------------------------------------------
   TV: the photo frame on a wall-mounted screen. Focus steps across the
   service row with the remote's right key, OK opens the focused service,
   and the room takes on that service's light.
   Storyboard: 0–3 focus moves · 4 OK · 5–6 launch · 7 back home.
   ------------------------------------------------------------------------ */
const TvScene: React.FC<{ active: boolean; photo: string }> = ({ active, photo }) => {
  const { t } = useI18n();
  const beat = useBeat(active, 8);
  const focus = beat <= 4 ? Math.min(beat, 3) : beat === 7 ? 0 : 3;
  const launching = beat === 5 || beat === 6;
  const focused = service(SERVICES[focus]);
  const key = beat >= 1 && beat <= 3 ? "right" : beat === 4 ? "ok" : beat === 7 ? "back" : "";

  return (
    <div
      className="ppv-scene ppv-scene--tv"
      data-active={active || undefined}
      style={{ color: focused.accent }}
    >
      <span className="ppv-room__glow" />
      <span className="ppv-room__floor" />
      <span className="ppv-chip">1–2 m</span>

      <div className="ppv-tv">
        <div className="ppv-tv__screen">
          <div className="ppv-ui ppv-ui--frame">
            <img className="ppv-ui__photo" src={photo} alt="" draggable={false} />
            <span className="ppv-ui__scrim" />
            <NovusLogo className="ppv-ui__logo" height="6cqw" />
            <span className="ppv-ui__clock">9:41</span>
            <div className="ppv-ui__caption">
              <span className="ppv-ui__title" key={focused.id}>
                {focused.title}
              </span>
              <span className="ppv-ui__resume">{t("home.resume")}</span>
            </div>
            <div className="ppv-ui__row">
              {SERVICES.map((id, index) => (
                <span
                  key={id}
                  className="ppv-ui__plate"
                  data-focus={index === focus || undefined}
                  data-press={(beat === 4 && index === focus) || undefined}
                >
                  <NvBrandArt id={id} name={service(id).title} />
                </span>
              ))}
            </div>
          </div>
          <MiniLoader
            id={focused.id}
            title={focused.title}
            accent={focused.accent}
            open={launching}
          />
        </div>
        <span className="ppv-tv__stand" />
      </div>

      {/* The remote as an object of its own: the key in use lights up. */}
      <div className="ppv-remote">
        <span className="ppv-remote__pad">
          <span
            className="ppv-remote__key ppv-remote__key--right"
            data-on={key === "right" || undefined}
          />
          <span className="ppv-remote__ok" data-on={key === "ok" || undefined} />
        </span>
        <span className="ppv-remote__btn" data-on={key === "back" || undefined} />
        <span className="ppv-remote__btn" />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------
   Tablet: today's page in the hands. A touch point travels to a tile,
   presses it, the service opens, and the page comes back.
   Storyboard: 0 touch arrives · 1 press · 2–3 launch · 4 back home · 5 rest.
   ------------------------------------------------------------------------ */
const TabletScene: React.FC<{ active: boolean; photo: string }> = ({ active, photo }) => {
  const { locale } = useI18n();
  const beat = useBeat(active, 6);
  const target = 2;
  const launching = beat === 2 || beat === 3;
  const now = new Date();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(now);
  const touch = beat === 0 ? "arrive" : beat === 1 ? "press" : "";
  const tapped = service(TABLET_TILES[target]);

  return (
    <div className="ppv-scene ppv-scene--tablet" data-active={active || undefined}>
      <span className="ppv-chip">30–50 cm</span>
      <div className="ppv-tablet">
        <div className="ppv-tablet__screen">
          <div className="ppv-ui ppv-ui--today">
            <div className="ppv-ui__band">
              <img className="ppv-ui__photo" src={photo} alt="" draggable={false} />
              <NovusLogo className="ppv-ui__logo" height="4.2cqw" />
              <span className="ppv-ui__glyphs">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="ppv-ui__glance">
              <span className="ppv-ui__day">{now.getDate()}</span>
              <span className="ppv-ui__weekday">{weekday}</span>
              <span className="ppv-ui__rule" />
              <span className="ppv-ui__time">9:41</span>
            </div>
            <div className="ppv-ui__tiles">
              {TABLET_TILES.map((id, index) => (
                <span
                  key={id}
                  className="ppv-ui__tile"
                  data-press={(beat === 1 && index === target) || undefined}
                >
                  <NvBrandArt id={id} name={service(id).title} />
                  {index === target && (
                    <span className="ppv-touch" data-state={touch || undefined} />
                  )}
                </span>
              ))}
              <span className="ppv-ui__tile ppv-ui__tile--slot" />
            </div>
          </div>
          <MiniLoader id={tapped.id} title={tapped.title} accent={tapped.accent} open={launching} />
        </div>
      </div>
    </div>
  );
};

/**
 * The viewing-mode preview on the onboarding posture step: a miniature of
 * the real Novus screens (the bundled photo and official service plates)
 * playing a short loop. Focus and touch live on the tiles themselves, so
 * they always land exactly. Only the visible scene runs its storyboard;
 * reduced motion shows a still frame. Decorative: the cards carry the text.
 */
export const PosturePreview: React.FC<PosturePreviewProps> = ({ mode }) => {
  const { t } = useI18n();
  const photo =
    BUNDLED_AMBIENT_ARTWORK.find((art) => art.id === "dawn-sea")?.url ??
    BUNDLED_AMBIENT_ARTWORK[0]?.url ??
    "";

  return (
    <figure className="ppv" data-mode={mode} aria-hidden="true">
      <div className="ppv__stage">
        <TvScene active={mode === "tv"} photo={photo} />
        <TabletScene active={mode === "tablet"} photo={photo} />
      </div>
      <figcaption className="ppv__caption">
        {mode === "tv" ? t("onboarding.previewTv") : t("onboarding.previewTablet")}
      </figcaption>
    </figure>
  );
};
