/* ============================================================================
   WWN — константы и типы базы, безопасные для клиентского бандла.
   Не импортируют astro:content, поэтому их можно тянуть в Svelte-остров.
   ============================================================================ */

export const TABS = ["factions", "units", "buildings", "misc"] as const;
export type TabId = (typeof TABS)[number];

export const CARD_TABS = ["units", "buildings", "misc"] as const;
export type CardTab = (typeof CARD_TABS)[number];

export const SORT_KEYS = [
  "name",
  "fullCost",
  "buildTime",
  "hp",
  "shield",
  "armor",
  "dps",
  "speed",
  "range",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";

export type TagMatchMode = "all" | "any";
