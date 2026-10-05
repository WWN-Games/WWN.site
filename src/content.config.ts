/* ============================================================================
   WWN — коллекции контента Astro (Content Layer + Zod).
   wiki  — Markdown-статьи: src/content/wiki/{ru,en}/<раздел>/<статья>.md
   units / buildings / factions / tags / sections — данные базы.
   ============================================================================ */

import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";

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
  (text: string): T[] =>
    JSON.parse(text)[key] as T[];

const wiki = defineCollection({
  loader: glob({ base: "./src/content/wiki", pattern: "**/*.md" }),
  schema: wikiSchema,
});

const units = defineCollection({
  loader: file("./src/data/units.json", { parser: jsonArray("units") }),
  schema: unitSchema,
});

const buildings = defineCollection({
  loader: file("./src/data/buildings.json", { parser: jsonArray("buildings") }),
  schema: buildingSchema,
});

const factions = defineCollection({
  loader: file("./src/data/factions.json", { parser: jsonArray("factions") }),
  schema: factionSchema,
});

const tags = defineCollection({
  loader: file("./src/data/tags.json", { parser: jsonArray("tags") }),
  schema: tagSchema,
});

const sections = defineCollection({
  loader: file("./src/data/sections.json", { parser: jsonArray("sections") }),
  schema: sectionSchema,
});

export const collections = { wiki, units, buildings, factions, tags, sections };
