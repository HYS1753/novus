import { useState, useEffect } from "react";

export interface FormattedTime {
  time: string;
  date: string;
}

export function useCurrentTime(): FormattedTime {
  const [currentTime, setCurrentTime] = useState<FormattedTime>(() => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: now.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    };
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime({
        time: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: now.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      });
    };

    // Update every 10 seconds to save CPU cycles on low-power devices
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  return currentTime;
}
