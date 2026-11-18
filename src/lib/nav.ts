/* ============================================================================
   WWN — основная навигация сайта. Один список для шапки, мобильного меню
   и футера, чтобы разделы не расходились между собой.
   ============================================================================ */

import type { DictKey } from "../i18n";

export interface NavItem {
  key: DictKey;
  /** Путь без base и языка: "wiki/". */
  path: string;
  /** Префикс пути для подсветки активного раздела. */
  section: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "nav.news", path: "news/", section: "news" },
  { key: "database.title", path: "database/", section: "database" },
  { key: "nav.wiki", path: "wiki/", section: "wiki" },
  { key: "nav.maps", path: "maps/", section: "maps" },
  { key: "nav.gallery", path: "gallery/", section: "gallery" },
  { key: "nav.videos", path: "videos/", section: "videos" },
  { key: "nav.feats", path: "feats/", section: "feats" },
  { key: "nav.rating", path: "rating/", section: "rating" },
];
