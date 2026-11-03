/* ============================================================================
   WWN — коллекции контента Astro (Content Layer + Zod).
   wiki  — Markdown-статьи: src/content/wiki/{ru,en}/<раздел>/<статья>.md
   units / buildings / factions / tags / sections — данные базы.
   ============================================================================ */

import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";

import { COLLECTION_FILES } from "./lib/collections";
import {
  buildingSchema,
  factionSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
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

export const collections = { wiki, units, buildings, factions, tags, sections };
