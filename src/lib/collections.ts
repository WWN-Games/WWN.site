/* ============================================================================
   WWN — реестр Zod-схем JSON-коллекций.
   Используется Content Layer, админкой и скриптом валидации.
   ============================================================================ */

import type { ZodType } from "astro/zod";

import type { CollectionName } from "./content-constants.ts";
import {
  buildingSchema,
  factionSchema,
  featSchema,
  gallerySchema,
  mapSchema,
  miscSchema,
  newsSchema,
  ratingSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
  videoSchema,
} from "./schemas.ts";

export const COLLECTION_SCHEMAS = {
  units: unitSchema,
  buildings: buildingSchema,
  misc: miscSchema,
  factions: factionSchema,
  tags: tagSchema,
  sections: sectionSchema,
  maps: mapSchema,
  gallery: gallerySchema,
  videos: videoSchema,
  feats: featSchema,
  news: newsSchema,
  ratings: ratingSchema,
} as const satisfies Record<CollectionName, ZodType>;
