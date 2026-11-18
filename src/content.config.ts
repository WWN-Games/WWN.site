/* ============================================================================
   WWN — коллекции контента Astro (Content Layer + Zod).
   wiki  — Markdown-статьи: src/content/wiki/{ru,en}/<раздел>/<статья>.md
   units / buildings / factions / tags / sections и т.д. — JSON-данные.
   ============================================================================ */

import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import type { ZodType } from "astro/zod";

import { COLLECTION_SCHEMAS } from "./lib/collections";
import { COLLECTION_FILES, type CollectionName } from "./lib/content-constants";
import { wikiSchema } from "./lib/schemas";

const jsonArray =
  <T>(key: string) =>
  (text: string): T[] => {
    const parsed: unknown = JSON.parse(text);
    const value =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[key] : undefined;
    if (!Array.isArray(value)) throw new Error(`Ожидался массив "${key}" в JSON-коллекции`);
    return value as T[];
  };

const jsonCollection = <S extends ZodType>(name: CollectionName, schema: S) =>
  defineCollection({
    loader: file(`./${COLLECTION_FILES[name]}`, { parser: jsonArray(name) }),
    schema,
  });

const wiki = defineCollection({
  loader: glob({ base: "./src/content/wiki", pattern: "**/*.md" }),
  schema: wikiSchema,
});

export const collections = {
  wiki,
  units: jsonCollection("units", COLLECTION_SCHEMAS.units),
  buildings: jsonCollection("buildings", COLLECTION_SCHEMAS.buildings),
  misc: jsonCollection("misc", COLLECTION_SCHEMAS.misc),
  factions: jsonCollection("factions", COLLECTION_SCHEMAS.factions),
  tags: jsonCollection("tags", COLLECTION_SCHEMAS.tags),
  sections: jsonCollection("sections", COLLECTION_SCHEMAS.sections),
  maps: jsonCollection("maps", COLLECTION_SCHEMAS.maps),
  gallery: jsonCollection("gallery", COLLECTION_SCHEMAS.gallery),
  videos: jsonCollection("videos", COLLECTION_SCHEMAS.videos),
  feats: jsonCollection("feats", COLLECTION_SCHEMAS.feats),
  news: jsonCollection("news", COLLECTION_SCHEMAS.news),
  ratings: jsonCollection("ratings", COLLECTION_SCHEMAS.ratings),
};
