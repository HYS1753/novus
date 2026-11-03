import { createContext } from "react";

export interface RunningApp {
  id: string;
  title: string;
}

export const RunningAppsContext = createContext<{
  apps: RunningApp[];
  activeId?: string;
  closingId: string | null;
  error: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
} | null>(null);
