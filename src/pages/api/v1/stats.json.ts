import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import statsJson from "@/data/stats.json";
import { statsSchema } from "@/lib/schemas";

import { byId, jsonResponse, STAT_IDS } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const [units, buildings, factions, tags] = await Promise.all([
    getCollection("units"),
    getCollection("buildings"),
    getCollection("factions"),
    getCollection("tags"),
  ]);
  const values: Record<(typeof STAT_IDS)[number], number> = {
    buildings: buildings.length,
    cards: units.length + buildings.length,
    factions: factions.length,
    maps: statsSchema.parse(statsJson).maps,
    tags: tags.length,
    units: units.length,
  };
  const items = STAT_IDS.map((id) => ({ id, value: values[id] })).sort(byId);
  return jsonResponse(items);
};
