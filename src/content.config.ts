/* ============================================================================
   WWN — коллекции контента Astro (Content Layer + Zod).
   wiki  — Markdown-статьи: src/content/wiki/{ru,en}/<раздел>/<статья>.md
   units / buildings / factions / tags / sections — данные базы.
   ============================================================================ */

import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";

import { COLLECTION_FILES } from "./lib/content-constants";
import {
  buildingSchema,
  factionSchema,
  featSchema,
  gallerySchema,
  mapSchema,
  miscSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
  videoSchema,
  wikiSchema,
} from "./lib/schemas";

const jsonArray =
  <T>(key: string) =>
  (text: string): T[] => {
    const parsed: unknown = JSON.parse(text);
    const value =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[key] : undefined;
    if (!Array.isArray(value)) throw new Error(`Ожидался массив "${key}" в JSON-коллекции`);
    return value as T[];
  };

const wiki = defineCollection({
  loader: glob({ base: "./src/content/wiki", pattern: "**/*.md" }),
  schema: wikiSchema,
});

const units = defineCollection({
  loader: file(`./${COLLECTION_FILES.units}`, { parser: jsonArray("units") }),
  schema: unitSchema,
});

const buildings = defineCollection({
  loader: file(`./${COLLECTION_FILES.buildings}`, { parser: jsonArray("buildings") }),
  schema: buildingSchema,
});

const misc = defineCollection({
  loader: file(`./${COLLECTION_FILES.misc}`, { parser: jsonArray("misc") }),
  schema: miscSchema,
});

const factions = defineCollection({
  loader: file(`./${COLLECTION_FILES.factions}`, { parser: jsonArray("factions") }),
  schema: factionSchema,
});

const tags = defineCollection({
  loader: file(`./${COLLECTION_FILES.tags}`, { parser: jsonArray("tags") }),
  schema: tagSchema,
});

const sections = defineCollection({
  loader: file(`./${COLLECTION_FILES.sections}`, { parser: jsonArray("sections") }),
  schema: sectionSchema,
});

const maps = defineCollection({
  loader: file(`./${COLLECTION_FILES.maps}`, { parser: jsonArray("maps") }),
  schema: mapSchema,
});

const gallery = defineCollection({
  loader: file(`./${COLLECTION_FILES.gallery}`, { parser: jsonArray("gallery") }),
  schema: gallerySchema,
});

const videos = defineCollection({
  loader: file(`./${COLLECTION_FILES.videos}`, { parser: jsonArray("videos") }),
  schema: videoSchema,
});

const feats = defineCollection({
  loader: file(`./${COLLECTION_FILES.feats}`, { parser: jsonArray("feats") }),
  schema: featSchema,
});

export const collections = {
  wiki,
  units,
  buildings,
  misc,
  factions,
  tags,
  sections,
  maps,
  gallery,
  videos,
  feats,
};
