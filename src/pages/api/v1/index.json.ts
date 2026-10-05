import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { canonical } from "@/lib/site";

import { byId, jsonResponse, STAT_IDS } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const [units, buildings, factions, tags] = await Promise.all([
    getCollection("units"),
    getCollection("buildings"),
    getCollection("factions"),
    getCollection("tags"),
  ]);
  const items = [
    { id: "buildings", url: canonical("api/v1/buildings.json"), count: buildings.length },
    { id: "factions", url: canonical("api/v1/factions.json"), count: factions.length },
    { id: "stats", url: canonical("api/v1/stats.json"), count: STAT_IDS.length },
    { id: "tags", url: canonical("api/v1/tags.json"), count: tags.length },
    { id: "units", url: canonical("api/v1/units.json"), count: units.length },
  ].sort(byId);
  return jsonResponse(items);
};
