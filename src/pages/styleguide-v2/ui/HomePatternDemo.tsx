import React, { useEffect, useRef, useState } from "react";
import { getAmbientArtworkForDay, useI18n, useNow } from "@/shared";
import { HomeV2, type HomeService } from "@/widgets";

const FRAME_W = 1368;
const FRAME_H = 912;
const MINUTE = 60_000;

/**
 * The shipped HomeV2 widget at the reference device size (Surface Pro 4,
 * 1368×912) with sample data, scaled to fit the guide.
 */
export const HomePatternDemo: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [ambient, setAmbient] = useState(false);
  const [sample] = useState(() => Date.now());
  const now = useNow();
  const { language } = useI18n();
  const artwork = getAmbientArtworkForDay(now);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / FRAME_W));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const services: HomeService[] = [
    { id: "netflix", name: "Netflix", state: "live", lastUsed: sample - 12 * MINUTE },
    { id: "youtube", name: "YouTube", state: "live", lastUsed: sample - 64 * MINUTE },
    { id: "disney", name: "Disney+", state: "idle" },
    { id: "tving", name: "TVING", state: "idle" },
    { id: "wavve", name: "Wavve", state: "idle" },
    { id: "watcha", name: "Watcha", state: "idle" },
    { id: "coupang", name: "Coupang Play", state: "idle" },
  ];
  const noop = () => undefined;

  return (
    <div ref={wrapRef} className="sg2-demo" style={{ height: FRAME_H * scale }}>
      <div
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <HomeV2
          now={now}
          photoUrl={artwork?.url ?? ""}
          sampleLabel={language === "ko" ? "예시 데이터" : "Sample data"}
          weather={{ city: "Seoul", condition: "clear", temperature: 12 }}
          services={services}
          locations={[
            { label: "Downloads", path: "C:\\Users\\novus\\Downloads" },
            { label: "C:\\", path: "C:\\" },
            { label: "D:\\", path: "D:\\" },
          ]}
          ambient={ambient}
          onOpenService={noop}
          onEndSession={noop}
          onOpenGallery={noop}
          onOpenFinder={noop}
          onOpenSettings={noop}
          onOpenSearch={noop}
          onOpenCalendar={noop}
          onOpenRadio={noop}
          onOpenRemote={noop}
          onEnterAmbient={() => setAmbient(true)}
          onWake={() => setAmbient(false)}
          onToggleTheme={noop}
          shortcutsEnabled={false}
        />
      </div>
    </div>
  );
};
