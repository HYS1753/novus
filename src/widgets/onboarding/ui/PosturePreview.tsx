import React from "react";
import type { PosturePreference } from "@/shared";

export interface PosturePreviewProps {
  mode: PosturePreference;
}

/**
 * Illustrates what each viewing mode means instead of rescaling the
 * onboarding itself. TV: viewed from the sofa, larger UI, arrow-key focus
 * moving across services. Tablet: held in hand, denser UI, touch within
 * thumb reach. Decorative only; the cards beside it carry the text.
 */
export const PosturePreview: React.FC<PosturePreviewProps> = ({ mode }) => (
  <div className="pp" data-mode={mode} aria-hidden="true">
    {/* ---------- TV: lean-back from the sofa ---------- */}
    <div className="pp__scene pp__scene--tv">
      <div className="pp__floor" />
      <div className="pp__viewer">
        <span className="pp__head" />
        <span className="pp__body" />
        <span className="pp__sofa" />
      </div>
      <div className="pp__distance">
        <span className="pp__distance-line" />
        <span className="pp__distance-label">1–2 m</span>
      </div>
      <div className="pp__tv">
        <div className="pp__screen pp__screen--tv">
          <span className="pp__ui-title pp__ui-title--tv" />
          <span className="pp__ui-line pp__ui-line--tv" />
          <span className="pp__ui-plates pp__ui-plates--tv">
            <i />
            <i />
            <i />
          </span>
          <span className="pp__focus" />
        </div>
        <span className="pp__stand" />
      </div>
    </div>

    {/* ---------- Tablet: in hand, close up ---------- */}
    <div className="pp__scene pp__scene--tablet">
      <div className="pp__tablet">
        <div className="pp__screen pp__screen--tablet">
          <span className="pp__ui-title pp__ui-title--tablet" />
          <span className="pp__ui-line pp__ui-line--tablet" />
          <span className="pp__ui-plates pp__ui-plates--tablet">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="pp__rail">
            <i />
            <i />
            <i />
          </span>
          <span className="pp__ripple" />
        </div>
        <span className="pp__thumb pp__thumb--left" />
        <span className="pp__thumb pp__thumb--right" />
      </div>
      <span className="pp__distance-label pp__distance-label--near">30–50 cm</span>
    </div>
  </div>
);
