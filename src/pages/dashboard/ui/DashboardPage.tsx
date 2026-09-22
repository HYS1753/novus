import React, { useState } from "react";
import { QuickHeader, MediaShelf } from "@/widgets";
import { GlassInput } from "@/shared";
import type { AppItem } from "@/entities";

const FEATURED_APPS: AppItem[] = [
  {
    id: "youtube",
    title: "YouTube",
    category: "media",
    url: "https://www.youtube.com",
    accentColor: "#ff0033",
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
    title: "Calendar",
    category: "tools",
    url: "https://calendar.google.com",
    accentColor: "#4285f4",
  },
  {
    id: "browser",
    title: "Search",
    category: "tools",
    url: "https://www.google.com",
    accentColor: "#34a853",
  },
];

export const DashboardPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApps = FEATURED_APPS.filter(
    (app) =>
      app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="dashboard-page">
      <QuickHeader />
      <main className="dashboard-page__content">
        <div className="dashboard-search">
          <GlassInput
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search apps"
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
          />
        </div>

        <MediaShelf title="바로가기" items={filteredApps} />
      </main>
    </div>
  );
};
