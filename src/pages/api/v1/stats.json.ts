import type { APIRoute } from "astro";

import { collectStats } from "@/lib/stats";

import { byId, jsonResponse, STAT_IDS } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const stats = await collectStats();
  const items = STAT_IDS.map((id) => ({ id, value: stats[id] })).sort(byId);
  return jsonResponse(items);
};
