/* ============================================================================
   WWN — живые цифры сайта: один источник для вики-хаба и публичного API.
   В статической сборке результат кэшируется на процесс; в dev — нет.
   ============================================================================ */

import { getCollection } from "astro:content";

import statsJson from "../data/stats.json";
import { statsSchema } from "./schemas";

export interface SiteStats {
  units: number;
  buildings: number;
  cards: number;
  factions: number;
  tags: number;
  maps: number;
}

async function loadStats(): Promise<SiteStats> {
  const [units, buildings, factions, tags] = await Promise.all([
    getCollection("units"),
    getCollection("buildings"),
    getCollection("factions"),
    getCollection("tags"),
  ]);
  return {
    units: units.length,
    buildings: buildings.length,
    cards: units.length + buildings.length,
    factions: factions.length,
    tags: tags.length,
    maps: statsSchema.parse(statsJson).maps,
  };
}

let cached: Promise<SiteStats> | null = null;

export function collectStats(): Promise<SiteStats> {
  if (import.meta.env.DEV) return loadStats();
  cached ??= loadStats().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}
