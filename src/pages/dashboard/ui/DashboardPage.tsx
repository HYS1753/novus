import React from "react";
import { QuickHeader, MediaShelf } from "@/widgets";
import type { AppItem } from "@/entities";

const FEATURED_APPS: AppItem[] = [
  {
    id: "youtube",
    title: "YouTube",
    category: "media",
    url: "https://www.youtube.com",
    accentColor: "#ef4444",
  },
  {
    id: "netflix",
    title: "Netflix",
    category: "media",
    url: "https://www.netflix.com",
    accentColor: "#e50914",
  },
  {
    id: "calendar",
    title: "Google Calendar",
    category: "tools",
    url: "https://calendar.google.com",
    accentColor: "#4285f4",
  },
  {
    id: "browser",
    title: "Web Search",
    category: "tools",
    url: "https://www.google.com",
    accentColor: "#10b981",
  },
];

export const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      <QuickHeader />
      <main className="dashboard-page__content">
        <MediaShelf title="Quick Media & Apps" items={FEATURED_APPS} />
      </main>
    </div>
  );
};
