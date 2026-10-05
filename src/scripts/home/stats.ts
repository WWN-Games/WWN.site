/* ============================================================================
   WWN — статистика главной: счётчики от 0 до data-target.
   Числа уже отрендерены сервером; JS анимирует их при появлении в окне.
   Повторная привязка к тому же блоку — по dataset-флагу.
   ============================================================================ */

import type { Lang } from "@/lib/site";
import { formatNumber, prefersReducedMotion } from "@/lib/utils";

const DURATION = 1400;

let observer: IntersectionObserver | null = null;

function currentLang(): Lang {
  return document.documentElement.lang === "en" ? "en" : "ru";
}

function targetOf(element: HTMLElement): number {
  const value = Number(element.dataset.target ?? "");
  return Number.isFinite(value) ? value : 0;
}

function animate(element: HTMLElement, target: number, lang: Lang): void {
  const start = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - start) / DURATION, 1);
    element.textContent = formatNumber(Math.round(target * (1 - (1 - progress) ** 3)), lang);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initStats(): void {
  const container = document.querySelector<HTMLElement>(".hero__stats");
  if (!container || container.dataset.countersBound === "true") return;
  container.dataset.countersBound = "true";

  observer?.disconnect();
  observer = null;

  const counters = [...container.querySelectorAll<HTMLElement>(".stat__num[data-target]")];
  if (!counters.length) return;
  const lang = currentLang();

  if (prefersReducedMotion()) {
    for (const counter of counters) counter.textContent = formatNumber(targetOf(counter), lang);
    return;
  }

  for (const counter of counters) counter.textContent = formatNumber(0, lang);

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        const counter = entry.target as HTMLElement;
        animate(counter, targetOf(counter), lang);
      }
    },
    { threshold: 0.4 },
  );
  for (const counter of counters) observer.observe(counter);
}

document.addEventListener("astro:before-swap", () => {
  observer?.disconnect();
  observer = null;
});

document.addEventListener("astro:page-load", initStats);
initStats();
