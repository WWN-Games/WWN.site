import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { byId, jsonResponse } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = await getCollection("factions");
  const items = entries.map((entry) => entry.data).sort((a, b) => a.order - b.order || byId(a, b));
  return jsonResponse(items);
};
