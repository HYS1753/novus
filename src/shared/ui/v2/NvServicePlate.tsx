import React from "react";
import { getBundledBrandAssetUrl } from "../../lib";
import { CloseIcon } from "../icons";

export type NvSessionState = "idle" | "live" | "ended";

/**
 * How each official brand asset sits in its plate. Key art covers the plate;
 * wide wordmarks are contained on the brand's own ground inside an optical
 * inset (percent of the plate's width `x` and height `top`/`bottom`), so each
 * logo reads at the same weight and sits on the plate's optical centre.
 * Watcha's file carries extra transparent space under the wordmark, so its
 * box drops a little to keep the letters centred.
 */
interface PlateArt {
  ground: string;
  fit: "cover" | "contain";
  inset?: { x: number; top: number; bottom: number };
}

const PLATE_GROUND: Record<string, PlateArt> = {
  netflix: { ground: "#000000", fit: "cover" },
  youtube: { ground: "#ffffff", fit: "contain", inset: { x: 16, top: 20, bottom: 20 } },
  disney: { ground: "#0b1d4d", fit: "cover" },
  tving: { ground: "#000000", fit: "contain", inset: { x: 18, top: 30, bottom: 30 } },
  wavve: { ground: "#1a3cff", fit: "cover" },
  watcha: { ground: "#0d0d0f", fit: "contain", inset: { x: 16, top: 27, bottom: 21 } },
  coupang: { ground: "#000000", fit: "cover" },
};

const DEFAULT_INSET = { x: 14, top: 18, bottom: 18 };

/** The brand art alone: a 16:9 field on the brand's ground (also used by the launch screen). */
export const NvBrandArt: React.FC<{ id: string; name: string; className?: string }> = ({
  id,
  name,
  className = "",
}) => {
  const asset = getBundledBrandAssetUrl(id);
  const plate = PLATE_GROUND[id] ?? { ground: "var(--nv-surface-raised)", fit: "contain" };
  const inset = plate.inset ?? DEFAULT_INSET;
  return (
    <span
      className={`nv-plate__field ${className}`}
      style={{ background: plate.ground }}
      aria-hidden="true"
    >
      {asset ? (
        <img
          className={`nv-plate__art nv-plate__art--${plate.fit}`}
          style={
            plate.fit === "contain"
              ? ({
                  "--art-x": `${inset.x}%`,
                  "--art-top": `${inset.top}%`,
                  "--art-bottom": `${inset.bottom}%`,
                } as React.CSSProperties)
              : undefined
          }
          src={asset}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={(event) => {
            event.currentTarget.dataset.loaded = "";
          }}
        />
      ) : (
        <span className="nv-plate__wordmark">{name}</span>
      )}
    </span>
  );
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
  /** "tile": art above, name below. "row": art left, name and state right (dense grids). */
  layout?: "tile" | "row";
  /** Ends the session; shown as a close button beside the plate when provided. */
  onClose?: () => void;
  closeLabel?: string;
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
  layout = "tile",
  onClose,
  closeLabel,
  className = "",
}) => {
  const stateLabel = state === "live" ? liveLabel : state === "ended" ? endedLabel : "";

  const field = <NvBrandArt id={id} name={name} />;
  const meta =
    state !== "idle" ? (
      <span className={`nv-status nv-status--${state}`}>
        <span className="nv-status__text">{stateLabel}</span>
      </span>
    ) : (
      shortcut && <span className="nv-plate__key nv-numeral">{shortcut}</span>
    );
  const main = (
    <button
      type="button"
      className="nv-plate__main"
      onClick={onPress}
      aria-label={stateLabel ? `${name}, ${stateLabel}` : name}
      aria-keyshortcuts={shortcut ? String(shortcut) : undefined}
    >
      {field}
      <span className="nv-plate__bar" aria-hidden="true">
        <span className="nv-plate__name">{name}</span>
        {meta}
      </span>
    </button>
  );

  return (
    <div className={`nv-plate nv-plate--${layout} nv-plate--${state} ${className}`}>
      {main}
      {onClose && (
        <button
          type="button"
          className="nv-plate__close"
          onClick={onClose}
          aria-label={closeLabel ?? name}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
};
