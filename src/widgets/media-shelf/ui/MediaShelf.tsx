import React from "react";
import { MediaCard } from "@/shared";
import { useLaunchApp } from "@/features";
import type { AppItem } from "@/entities";

export interface MediaShelfProps {
  title?: string;
  items: AppItem[];
  onItemClick?: (item: AppItem) => void;
}

export const MediaShelf: React.FC<MediaShelfProps> = ({ title, items, onItemClick }) => {
  const { launchApp } = useLaunchApp();

  return (
    <section className="media-shelf">
      {title && <h2 className="media-shelf__title">{title}</h2>}
      <div className="media-shelf__grid">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            title={item.title}
            category={item.category.toUpperCase()}
            accentColor={item.accentColor}
            imageUrl={item.imageUrl || item.iconUrl}
            imageFit={item.imageFit}
            bannerUrl={item.bannerUrl}
            onClick={() => (onItemClick ? onItemClick(item) : launchApp(item))}
          />
        ))}
      </div>
    </section>
  );
};
