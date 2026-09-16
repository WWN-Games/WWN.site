/* ============================================================================
   WWN — статистика главной: живые числа из data/stats.json
   с фолбэком на значения из site-config.js.
   ============================================================================ */

import { $$, formatNumber, prefersReduced } from "../utils.js";
import { getLang } from "../i18n.js";
import { loadStats } from "../stats-data.js";

let stats = {};
let counterGen = 0;

const statKey = (el) => (el.nextElementSibling?.getAttribute("data-i18n") || "").replace("stats.", "");
const statTarget = (el) => stats[statKey(el)] ?? 0;

/** Мгновенно показать актуальные значения (например, при смене языка). */
export function syncStats(lang) {
  counterGen += 1;
  $$(".stat__num").forEach((el) => {
    el.textContent = formatNumber(statTarget(el), lang);
  });
}

async function loadLiveStats() {
  if (!$$(".stat__num").length) return;
  const live = await loadStats();
  let changed = false;
  for (const key of ["units", "factions", "maps"]) {
    if (live[key] > 0 && stats[key] !== live[key]) {
      stats[key] = live[key];
      changed = true;
    }
  }
  if (changed) syncStats(getLang());
}

export function initStats(config) {
  stats = { ...(config.stats || {}) };
  const counters = $$(".stat__num");
  if (!counters.length) return;
  const lang = getLang();

  if (prefersReduced) {
    counters.forEach((el) => {
      el.textContent = formatNumber(statTarget(el), lang);
    });
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const el = entry.target;
          const target = statTarget(el);
          const start = performance.now();
          // поколение фиксируем на старте: если значения обновятся (данные/язык),
          // анимация остановится и syncStats покажет точное число
          const myGen = counterGen;
          const step = (now) => {
            if (myGen !== counterGen) return;
            const progress = Math.min((now - start) / 1400, 1);
            el.textContent = formatNumber(Math.round(target * (1 - (1 - progress) ** 3)), lang);
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => observer.observe(el));
  }

  loadLiveStats();
}
