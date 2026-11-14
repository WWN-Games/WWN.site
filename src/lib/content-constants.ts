/* ============================================================================
   WWN — чистые константы контента. Не импортируют Zod/Astro и безопасны
   для клиентского бандла админки.
   ============================================================================ */

export const SECTION_ICONS = [
  "book",
  "shield",
  "cube",
  "gear",
  "compass",
  "users",
  "clock",
  "rocket",
  "chat",
] as const;

export const TAG_GROUPS = ["tier", "class", "movement", "mod", "weapon", "sector"] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

/** Группы тегов, которые выбираются у обычной карточки. */
export const CARD_TAG_GROUPS = ["tier", "class", "movement", "mod"] as const;

/** Группы тегов оружия: назначение/тип и сектор обстрела. */
export const WEAPON_TAG_GROUPS = ["weapon", "sector"] as const;

/** Фиксированные варианты выгрузки транспорта. */
export const UNLOAD_OPTIONS = ["shore", "water", "air", "underwater", "space"] as const;
export type UnloadOption = (typeof UNLOAD_OPTIONS)[number];

export const COLLECTION_FILES = {
  units: "src/data/units.json",
  buildings: "src/data/buildings.json",
  misc: "src/data/misc.json",
  factions: "src/data/factions.json",
  tags: "src/data/tags.json",
  sections: "src/data/sections.json",
  maps: "src/data/maps.json",
  gallery: "src/data/gallery.json",
  videos: "src/data/videos.json",
  feats: "src/data/feats.json",
} as const;

export type CollectionName = keyof typeof COLLECTION_FILES;

export const COLLECTION_NAMES = Object.keys(COLLECTION_FILES) as CollectionName[];
