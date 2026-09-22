import React from "react";
import { MediaCard } from "@/shared";
import { useLaunchApp } from "@/features";
import type { AppItem } from "@/entities";

export interface MediaShelfProps {
  title: string;
  items: AppItem[];
}

export const MediaShelf: React.FC<MediaShelfProps> = ({ title, items }) => {
  const { launchApp } = useLaunchApp();

  return (
    <section className="media-shelf">
      <h2 className="media-shelf__title">{title}</h2>
      <div className="media-shelf__grid">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            title={item.title}
            category={item.category.toUpperCase()}
            accentColor={item.accentColor}
            onClick={() => launchApp(item)}
          />
        ))}
      </div>
    </section>
  );
};
