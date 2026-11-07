import React, { useMemo } from "react";

export interface NvMonthCalendarProps {
  /** Any date inside the month to show; also marks "today". */
  date: Date;
  locale?: string;
  className?: string;
}

type WeekInfoLocale = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
};

/** First weekday as JS index (0 = Sunday), from the locale when the engine knows it. */
function firstWeekday(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as WeekInfoLocale;
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (firstDay) return firstDay % 7; // Intl uses 1 = Monday … 7 = Sunday
  } catch {
    // Fall through to the regional default below.
  }
  return 0;
}

/** Month grid. Sunday and Saturday carry their calendar colours; today is filled. */
export const NvMonthCalendar: React.FC<NvMonthCalendarProps> = ({
  date,
  locale = "ko-KR",
  className = "",
}) => {
  const { weekdays, weeks, title } = useMemo(() => {
    const start = firstWeekday(locale);
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2023-01-01 is a Sunday: offsetting from it yields each weekday name.
    const weekdays = Array.from({ length: 7 }, (_, i) => {
      const jsDay = (start + i) % 7;
      return { jsDay, label: weekdayFormat.format(new Date(2023, 0, 1 + jsDay)) };
    });

    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() - start + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((lead + daysInMonth) / 7) * 7;

    const cells = Array.from({ length: cellCount }, (_, i) => new Date(year, month, 1 - lead + i));
    const weeks: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const title = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(date);
    return { weekdays, weeks, title };
  }, [date, locale]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dayClass = (jsDay: number) =>
    jsDay === 0 ? " nv-calendar--sun" : jsDay === 6 ? " nv-calendar--sat" : "";

  return (
    <table className={`nv-calendar ${className}`}>
      <caption className="nv-visually-hidden">{title}</caption>
      <thead>
        <tr>
          {weekdays.map((weekday) => (
            <th key={weekday.jsDay} scope="col" className={dayClass(weekday.jsDay)}>
              {weekday.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0].toISOString()}>
            {week.map((day) => {
              const outside = day.getMonth() !== date.getMonth();
              const today = isSameDay(day, date);
              return (
                <td
                  key={day.toISOString()}
                  className={`nv-numeral${dayClass(day.getDay())}${outside ? " is-outside" : ""}${today ? " is-today" : ""}`}
                  aria-current={today ? "date" : undefined}
                >
                  <span>{day.getDate()}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
