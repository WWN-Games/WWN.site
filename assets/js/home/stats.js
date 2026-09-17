/* ============================================================================
   WWN — статистика главной: живые числа из data/stats.json.
   ============================================================================ */

import { $$, formatNumber, prefersReduced } from "../utils.js";
import { getLang } from "../i18n.js";
import { loadStats } from "../stats-data.js";

let stats = {};
let counterGen = 0;

const statTarget = (el) => stats[el.dataset.stat] ?? 0;

/** Мгновенно показать актуальные значения (например, при смене языка). */
export function syncStats(lang) {
  counterGen += 1;
  $$(".stat__num").forEach((el) => {
    el.textContent = formatNumber(statTarget(el), lang);
  });
}

export async function initStats() {
  stats = await loadStats();
  const counters = $$(".stat__num");
  if (!counters.length) return;
  const lang = getLang();

  if (prefersReduced) {
    counters.forEach((el) => {
      el.textContent = formatNumber(statTarget(el), lang);
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const el = entry.target;
        const target = statTarget(el);
        const start = performance.now();
        // поколение фиксируем на старте: если язык переключат и syncStats
        // выставит точное число, анимация остановится
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
