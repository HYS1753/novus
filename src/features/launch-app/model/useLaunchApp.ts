import { useCallback } from "react";
import { launchStreamingMedia } from "@/shared";
import type { AppItem } from "@/entities";

export function useLaunchApp() {
  const launchApp = useCallback(async (app: AppItem) => {
    try {
      if (app.url.startsWith("http://") || app.url.startsWith("https://")) {
        await launchStreamingMedia(app.id, app.title, app.url);
      } else {
        console.info(`Native app execution requested: ${app.id}`);
      }
    } catch (error) {
      console.error(`Failed to launch app [${app.title}]:`, error);
    }
  }, []);

  return { launchApp };
}
