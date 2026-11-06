import React from "react";
import { getBundledBrandAssetUrl } from "../../lib";

export type NvSessionState = "idle" | "live" | "ended";

/**
 * How each official brand asset sits in its plate. Wide wordmarks with a
 * transparent background are contained on the brand's own ground; full
 * key art covers the plate.
 */
const PLATE_GROUND: Record<string, { ground: string; fit: "cover" | "contain" }> = {
  netflix: { ground: "#000000", fit: "cover" },
  youtube: { ground: "#ffffff", fit: "contain" },
  disney: { ground: "#0b1d4d", fit: "cover" },
  tving: { ground: "#000000", fit: "contain" },
  wavve: { ground: "#1a3cff", fit: "cover" },
  watcha: { ground: "#0d0d0f", fit: "contain" },
  coupang: { ground: "#000000", fit: "cover" },
};

export interface NvServicePlateProps {
  id: string;
  name: string;
  /** Number-key shortcut shown on the plate (1–9). */
  shortcut?: number;
  state?: NvSessionState;
  /** Localized state labels, so the plate never hard-codes copy. */
  liveLabel?: string;
  endedLabel?: string;
  onPress?: () => void;
  className?: string;
}

export const NvServicePlate: React.FC<NvServicePlateProps> = ({
  id,
  name,
  shortcut,
  state = "idle",
  liveLabel = "실행 중",
  endedLabel = "종료됨",
  onPress,
  className = "",
}) => {
  const asset = getBundledBrandAssetUrl(id);
  const plate = PLATE_GROUND[id] ?? { ground: "var(--nv-surface-raised)", fit: "contain" };
  const stateLabel = state === "live" ? liveLabel : state === "ended" ? endedLabel : "";

  return (
    <button
      type="button"
      className={`nv-plate nv-plate--${state} ${className}`}
      onClick={onPress}
      aria-label={stateLabel ? `${name}, ${stateLabel}` : name}
      aria-keyshortcuts={shortcut ? String(shortcut) : undefined}
    >
      <span className="nv-plate__field" style={{ background: plate.ground }} aria-hidden="true">
        {asset ? (
          <img
            className={`nv-plate__art nv-plate__art--${plate.fit}`}
            src={asset}
            alt=""
            draggable={false}
            decoding="async"
          />
        ) : (
          <span className="nv-plate__wordmark">{name}</span>
        )}
      </span>
      <span className="nv-plate__bar" aria-hidden="true">
        <span className="nv-plate__name">{name}</span>
        {state !== "idle" ? (
          <span className={`nv-status nv-status--${state}`}>
            <span className="nv-status__text">{stateLabel}</span>
          </span>
        ) : (
          shortcut && <span className="nv-plate__key nv-numeral">{shortcut}</span>
        )}
      </span>
    </button>
  );
};
