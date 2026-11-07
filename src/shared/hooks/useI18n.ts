import { useCallback, useMemo } from "react";
import {
  detectLanguage,
  formatList,
  formatRelativeTime,
  INTL_LOCALE,
  translate,
  type MessageKey,
  type MessageVars,
} from "../lib/i18n";
import { usePreference } from "./usePreference";

/** Current language plus `t()` and locale-aware formatters. */
export function useI18n() {
  const [stored] = usePreference("language");
  const language = stored ?? detectLanguage();
  const locale = INTL_LOCALE[language];

  const t = useCallback(
    (key: MessageKey, vars?: MessageVars) => translate(language, key, vars),
    [language],
  );

  return useMemo(
    () => ({
      language,
      locale,
      t,
      relativeTime: (at: number) => formatRelativeTime(language, at),
      list: (items: string[]) => formatList(language, items),
      time: (date: Date) =>
        new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date),
    }),
    [language, locale, t],
  );
}
