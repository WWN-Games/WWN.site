/* ============================================================================
   WWN API v1 — общий конверт ответа для статических JSON-эндпоинтов.
   Все эндпоинты отдают: { schemaVersion, generatedAt, count, items }.
   ============================================================================ */

export const API_SCHEMA_VERSION = 1;

export const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
} as const;

export interface ApiEnvelope<T> {
  schemaVersion: number;
  generatedAt: string;
  count: number;
  items: T[];
}

/** Идентификаторы живых цифр stats.json (см. src/lib/wiki.ts: getStats). */
export const STAT_IDS = ["buildings", "cards", "factions", "maps", "tags", "units"] as const;

/** Стабильный порядок по id. */
export function byId<T extends { id: string }>(a: T, b: T): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function jsonResponse<T>(items: T[]): Response {
  const payload: ApiEnvelope<T> = {
    schemaVersion: API_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, { headers: API_HEADERS });
}
