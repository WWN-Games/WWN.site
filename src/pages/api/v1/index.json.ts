import type { APIRoute } from "astro";

import { canonical } from "@/lib/site";
import { collectStats } from "@/lib/stats";

import { byId, jsonResponse, STAT_IDS } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const stats = await collectStats();
  const items = [
    { id: "buildings", url: canonical("api/v1/buildings.json"), count: stats.buildings },
    { id: "factions", url: canonical("api/v1/factions.json"), count: stats.factions },
    { id: "maps", url: canonical("api/v1/maps.json"), count: stats.maps },
    { id: "misc", url: canonical("api/v1/misc.json"), count: stats.misc },
    { id: "stats", url: canonical("api/v1/stats.json"), count: STAT_IDS.length },
    { id: "tags", url: canonical("api/v1/tags.json"), count: stats.tags },
    { id: "units", url: canonical("api/v1/units.json"), count: stats.units },
  ].sort(byId);
  return jsonResponse(items);
};
