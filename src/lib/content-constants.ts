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

export const UNIT_TYPES = ["ground", "air", "naval", "space", "support"] as const;
export const BUILDING_TYPES = ["economy", "defense", "structure"] as const;
export const TAG_GROUPS = ["tier", "class", "movement", "mod"] as const;

export const COLLECTION_FILES = {
  units: "src/data/units.json",
  buildings: "src/data/buildings.json",
  factions: "src/data/factions.json",
  tags: "src/data/tags.json",
  sections: "src/data/sections.json",
} as const;

export type CollectionName = keyof typeof COLLECTION_FILES;

export const COLLECTION_NAMES = Object.keys(COLLECTION_FILES) as CollectionName[];
