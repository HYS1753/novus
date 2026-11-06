import React from "react";
import { ChevronRightIcon } from "../icons";

export interface NvListRowProps {
  title: string;
  description?: string;
  /** Current value shown on the right of a navigable row. */
  value?: string;
  /** A control (toggle, segmented, slider) rendered on the right. */
  control?: React.ReactNode;
  /** Makes the whole row a button that opens a sub-view. */
  onPress?: () => void;
  icon?: React.ReactNode;
  /** Put the control under the text instead of beside it (wide controls). */
  stacked?: boolean;
}

/** Settings row. With `onPress` the row is one button; otherwise the control owns focus. */
export const NvListRow: React.FC<NvListRowProps> = ({
  title,
  description,
  value,
  control,
  onPress,
  icon,
  stacked = false,
}) => {
  const body = (
    <>
      {icon && (
        <span className="nv-row__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="nv-row__text">
        <span className="nv-row__title">{title}</span>
        {description && <span className="nv-row__desc">{description}</span>}
      </span>
      {value && <span className="nv-row__value">{value}</span>}
      {onPress && (
        <span className="nv-row__chev" aria-hidden="true">
          <ChevronRightIcon size={18} />
        </span>
      )}
    </>
  );

  if (onPress) {
    return (
      <button type="button" className="nv-row nv-row--button" onClick={onPress}>
        {body}
      </button>
    );
  }

  return (
    <div className={`nv-row${stacked ? " nv-row--stacked" : ""}`}>
      {body}
      {control && <span className="nv-row__control">{control}</span>}
    </div>
  );
};

export interface NvListSectionProps {
  title?: string;
  children: React.ReactNode;
}

export const NvListSection: React.FC<NvListSectionProps> = ({ title, children }) => (
  <section className="nv-list-section">
    {title && <h3 className="nv-list-section__title">{title}</h3>}
    <div className="nv-list-section__rows">{children}</div>
  </section>
);
