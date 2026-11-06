import { getPreference, type LanguagePreference } from "../preferences";
import { en } from "./messages/en";
import { ja } from "./messages/ja";
import { ko, type MessageKey, type Messages } from "./messages/ko";
import { zhCN } from "./messages/zh-CN";

export type { MessageKey, Messages };

export interface LanguageOption {
  code: LanguagePreference;
  /** Name written in its own language, so anyone can find theirs. */
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "ko", nativeName: "한국어" },
  { code: "en", nativeName: "English" },
  { code: "ja", nativeName: "日本語" },
  { code: "zh-CN", nativeName: "简体中文" },
];

const CATALOGS: Record<LanguagePreference, Messages> = { ko, en, ja, "zh-CN": zhCN };

/** BCP 47 tag used for Intl formatting and the `lang` attribute. */
export const INTL_LOCALE: Record<LanguagePreference, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  "zh-CN": "zh-CN",
};

/** Best match from the OS/browser languages; Korean when nothing matches. */
export function detectLanguage(
  candidates: readonly string[] = navigator.languages ?? [],
): LanguagePreference {
  for (const tag of candidates) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("ko")) return "ko";
    if (lower.startsWith("ja")) return "ja";
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("en")) return "en";
  }
  return "ko";
}

export function resolveLanguage(): LanguagePreference {
  return getPreference("language") ?? detectLanguage();
}

export type MessageVars = Record<string, string | number>;

export function translate(
  language: LanguagePreference,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const template = CATALOGS[language][key] ?? ko[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** "12분 전", "12 minutes ago", "12 分前", "12分钟前". */
export function formatRelativeTime(language: LanguagePreference, at: number, now = Date.now()) {
  const format = new Intl.RelativeTimeFormat(INTL_LOCALE[language], { numeric: "auto" });
  const seconds = Math.round((at - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return format.format(0, "minute");
  if (abs < 3600) return format.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return format.format(Math.round(seconds / 3600), "hour");
  return format.format(Math.round(seconds / 86400), "day");
}

/** Joins names the locale's way: "Netflix, YouTube" / "Netflix、YouTube". */
export function formatList(language: LanguagePreference, items: string[]): string {
  return new Intl.ListFormat(INTL_LOCALE[language], { style: "narrow", type: "unit" }).format(
    items,
  );
}
