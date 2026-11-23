/* ============================================================================
   WWN — живые цифры сайта: один источник для вики-хаба и публичного API.
   В статической сборке результат кэшируется на процесс; в dev — нет.
   ============================================================================ */

import { getCollection } from "astro:content";

interface SiteStats {
  units: number;
  buildings: number;
  misc: number;
  cards: number;
  factions: number;
  tags: number;
  maps: number;
}

async function loadStats(): Promise<SiteStats> {
  const [units, buildings, misc, factions, tags, maps] = await Promise.all([
    getCollection("units"),
    getCollection("buildings"),
    getCollection("misc"),
    getCollection("factions"),
    getCollection("tags"),
    getCollection("maps"),
  ]);
  return {
    units: units.length,
    buildings: buildings.length,
    misc: misc.length,
    cards: units.length + buildings.length + misc.length,
    factions: factions.length,
    tags: tags.length,
    maps: maps.length,
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
