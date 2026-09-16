/* ============================================================================
   WWN — hero главной: лёгкий параллакс фона и ореола под курсором.
   Окружение — статичные градиенты; JS только плавно двигает два слоя.
   ============================================================================ */

import { $, finePointer, liteMode, prefersReduced } from "../utils.js";

export function initHero() {
  if (prefersReduced || !finePointer || liteMode) return;

  const layers = [
    { el: $(".hero__bg"), dx: -9, dy: -7 },
    { el: $(".hero__aura"), dx: 12, dy: 9 }
  ].filter((layer) => layer.el);
  if (!layers.length) return;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let rafId = 0;

  const tick = () => {
    rafId = 0;
    x += (targetX - x) * 0.055;
    y += (targetY - y) * 0.055;
    for (const layer of layers) {
      layer.el.style.transform = `translate3d(${(x * layer.dx).toFixed(2)}px, ${(y * layer.dy).toFixed(2)}px, 0)`;
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
    { passive: true }
  );
}
