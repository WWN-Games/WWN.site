import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { byId, jsonResponse } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = await getCollection("tags");
  const items = entries.map((entry) => entry.data).sort(byId);
  return jsonResponse(items);
};
