import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { byId, jsonResponse, withDerivedDps } from "./_shared";

export const prerender = true;

export const GET: APIRoute = async () => {
  const entries = await getCollection("buildings");
  const items = entries.map((entry) => withDerivedDps(entry.data)).sort(byId);
  return jsonResponse(items);
};
