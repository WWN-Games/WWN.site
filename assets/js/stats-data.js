/* ============================================================================
   WWN — живые числа сайта: единственный источник — data/stats.json.
   Значения из site-data.js используются как запас, если файл недоступен.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { SITE_DATA } from "./site-data.js";
import { abs } from "./utils.js";

const KEYS = ["units", "factions", "maps"];

export async function loadStats() {
  const stats = { ...(SITE_DATA.stats || {}) };
  try {
    const res = await fetch(abs(`data/stats.json?v=${WWN_CONFIG.version}`));
    if (!res.ok) return stats;
    const live = await res.json();
    for (const key of KEYS) {
      if (Number.isFinite(live[key])) stats[key] = live[key];
    }
  } catch {
    /* нет данных — остаются значения из конфига */
  }
  return stats;
}
