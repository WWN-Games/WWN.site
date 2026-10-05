/* ============================================================================
   WWN — константы сайта.
   Используются и в astro.config.ts, и в markdown-плагинах, и в компонентах.
   ============================================================================ */

export const SITE = "https://wwn-games.github.io";
export const BASE = "/WWN.site";

export const LOCALES = ["ru", "en"] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Lang = "ru";

/** Префикс base без хвостового слэша: "" для корня. */
const BASE_PREFIX = BASE.replace(/\/+$/, "");

/** Абсолютный путь от корня сайта с учётом base. */
export function href(path: string): string {
  return `${BASE_PREFIX}/${path.replace(/^\/+/, "")}`;
}

/** Путь с учётом языка: /wiki/... для ru, /en/wiki/... для en. */
export function localeHref(lang: Lang, path: string): string {
  const clean = path.replace(/^\/+/, "");
  return lang === DEFAULT_LOCALE ? href(clean) : href(`${lang}/${clean}`);
}

/** Полный URL страницы. */
export function canonical(path: string): string {
  return `${SITE}${href(path)}`;
}

/** Тот же путь на другом языке: /wiki/… ↔ /en/wiki/…. */
export function switchLangPath(pathname: string, target: Lang): string {
  const clean = pathname.startsWith(BASE_PREFIX) ? pathname.slice(BASE_PREFIX.length) : pathname;
  const withoutLocale = clean === "/en" || clean.startsWith("/en/") ? clean.slice(3) || "/" : clean;
  return target === "en" ? href(`en${withoutLocale}`) : href(withoutLocale);
}
