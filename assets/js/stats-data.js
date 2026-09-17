/* ============================================================================
   WWN — живые числа сайта.
   Юниты и фракции считаются по базе (units.json + buildings.json +
   factions.json) — руками их править не нужно. Карты берутся из
   data/stats.json (в данных сайта их нет), он же служит резервом,
   если база недоступна. Результат кэшируется на сессию, чтобы не тянуть
   JSON на каждой странице.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { abs } from "./utils.js";

const CACHE_KEY = `wwn-db-counts-v${WWN_CONFIG.version}`;
const FALLBACK = { units: 180, factions: 2, maps: 13 };

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const counts = JSON.parse(raw);
    return Number.isFinite(counts?.units) && Number.isFinite(counts?.factions) ? counts : null;
  } catch {
    return null;
  }
}

function writeCache(counts) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(counts)); } catch {}
}

async function fetchCounts() {
  const count = (name, key) =>
    fetch(abs(`data/${name}.json?v=${WWN_CONFIG.version}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => json?.[key]?.length ?? null);
  const [units, buildings, factions] = await Promise.all([
    count("units", "units"),
    count("buildings", "buildings"),
    count("factions", "factions")
  ]);
  if (!Number.isFinite(units) || !Number.isFinite(buildings) || !Number.isFinite(factions)) {
    throw new Error("counts");
  }
  return { units: units + buildings, factions };
}

export async function loadStats() {
  const file = fetch(abs(`data/stats.json?v=${WWN_CONFIG.version}`))
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));

  const counts = (async () => {
    const cached = readCache();
    if (cached) return cached;
    const fresh = await fetchCounts();
    writeCache(fresh);
    return fresh;
  })().catch(() => null);

  const [fromFile, fromDb] = await Promise.all([file, counts]);
  return { ...FALLBACK, ...fromFile, ...(fromDb || {}) };
}
