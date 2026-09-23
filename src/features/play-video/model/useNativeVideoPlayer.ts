import { useState, useCallback } from "react";
import { playVideoNative } from "@/shared";

export function useNativeVideoPlayer() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; usedMpv: boolean } | null>(null);

  const playVideo = useCallback(async (filePath: string) => {
    setIsPlaying(true);
    try {
      const result = await playVideoNative(filePath);
      setFeedback({
        message: result.message,
        usedMpv: result.used_mpv,
      });

      // Clear feedback banner after 5 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 5000);
    } catch (err) {
      setFeedback({
        message: `Failed to launch video player: ${String(err)}`,
        usedMpv: false,
      });
    } finally {
      setIsPlaying(false);
    }
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return {
    isPlaying,
    feedback,
    playVideo,
    clearFeedback,
  };
}
