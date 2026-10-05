/* ============================================================================
   WWN — hero главной: лёгкий параллакс фона и ореола под курсором.
   Окружение — статичные градиенты; JS только плавно двигает два слоя.
   Инициализация на каждом astro:page-load, окно-слушатели снимаются
   AbortController'ом, повторная привязка к тому же hero — по dataset-флагу.
   ============================================================================ */

import { hasFinePointer, isLiteMode, prefersReducedMotion } from "@/lib/utils";

let controller: AbortController | null = null;

function initHero(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero || hero.dataset.parallaxBound === "true") return;
  hero.dataset.parallaxBound = "true";

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  if (prefersReducedMotion() || !hasFinePointer() || isLiteMode()) return;

  const layers = [
    { element: hero.querySelector<HTMLElement>(".hero__bg"), dx: -9, dy: -7 },
    { element: hero.querySelector<HTMLElement>(".hero__aura"), dx: 12, dy: 9 },
  ].filter(
    (layer): layer is { element: HTMLElement; dx: number; dy: number } => layer.element !== null,
  );
  if (!layers.length) return;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let rafId = 0;

  const tick = (): void => {
    rafId = 0;
    x += (targetX - x) * 0.055;
    y += (targetY - y) * 0.055;
    for (const layer of layers) {
      layer.element.style.transform = `translate3d(${(x * layer.dx).toFixed(2)}px, ${(y * layer.dy).toFixed(2)}px, 0)`;
    }
    if (Math.abs(targetX - x) > 0.0005 || Math.abs(targetY - y) > 0.0005) {
      rafId = requestAnimationFrame(tick);
    }
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    { passive: true, signal },
  );
}

document.addEventListener("astro:before-swap", () => {
  controller?.abort();
  controller = null;
});

document.addEventListener("astro:page-load", initHero);
initHero();
