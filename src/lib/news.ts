/* ============================================================================
   WWN — новости: подписи тегов, ссылки и сортировка. Без Astro, чтобы
   модуль можно было использовать в компонентах и тестах.
   ============================================================================ */

import type { NewsItem, NewsTag, Text } from "./schemas";
import { type Lang, localeHref } from "./site";

export const NEWS_TAG_LABELS = {
  update: { ru: "Обновление", en: "Update" },
  news: { ru: "Новости", en: "News" },
} satisfies Record<NewsTag, Text>;

interface ResolvedNewsLink {
  href: string;
  external: boolean;
}

/** Ссылка новости: http(s) — внешняя, остальное — путь от корня сайта. */
export function resolveNewsLink(link: NewsItem["link"], lang: Lang): ResolvedNewsLink | null {
  if (link === undefined) return null;
  const raw = typeof link === "string" ? link : link[lang];
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return { href: raw, external: true };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  return { href: localeHref(lang, raw), external: false };
}

/** Закреплённые сверху, затем по дате, затем по order. */
export function sortNews(a: NewsItem, b: NewsItem): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return b.date.localeCompare(a.date) || a.order - b.order || a.id.localeCompare(b.id);
}
