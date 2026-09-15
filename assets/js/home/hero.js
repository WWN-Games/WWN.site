/* ============================================================================
   WWN — hero главной: звёздное поле, параллакс, дрейф фона.
   Всё дорогое окружение выключено для reduced motion, тач-устройств и
   слабых машин (liteMode); canvas останавливается, когда hero не виден.
   ============================================================================ */

import { $, debounce, finePointer, liteMode, prefersReduced } from "../utils.js";

/* -------------------------------------------------------------- звёзды -- */
let starSprite = null;

function getStarSprite() {
  if (starSprite) return starSprite;
  const sprite = document.createElement("canvas");
  const size = 32;
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext("2d");
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, "rgba(235, 246, 255, 1)");
  glow.addColorStop(0.35, "rgba(180, 220, 255, 0.55)");
  glow.addColorStop(1, "rgba(120, 180, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  starSprite = sprite;
  return starSprite;
}

function initStarfield() {
  const canvas = $("#starfield");
  if (!canvas || prefersReduced) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const sprite = getStarSprite();
  if (!ctx || !sprite) return;

  const DPR = Math.min(window.devicePixelRatio || 1, liteMode ? 1 : 1.5);
  const FRAME = liteMode ? 1000 / 30 : 0;
  const DENSITY = liteMode ? 15000 : 9500;
  const MAX_STARS = liteMode ? 90 : 200;
  const DUST_COUNT = liteMode ? 0 : 12;

  let width = 0;
  let height = 0;
  let stars = [];
  let dust = [];
  let meteors = [];
  let nextMeteor = 2600;
  let rafId = 0;
  let lastDraw = 0;
  let lastTime = 0;
  let visible = true;

  function build() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const count = Math.min(MAX_STARS, Math.round((width * height) / DENSITY));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      s: Math.random() < 0.82 ? 1.1 : 2,
      a: Math.random() * 0.5 + 0.25,
      speed: Math.random() * 0.12 + 0.02,
      twinkle: Math.random() * Math.PI * 2
    }));

    dust = Array.from({ length: DUST_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 26 + 10,
      a: Math.random() * 0.06 + 0.03,
      speed: Math.random() * 0.18 + 0.04
    }));

    meteors = [];
  }

  function spawnMeteor() {
    const fromTop = Math.random() > 0.35;
    meteors.push({
      x: fromTop ? Math.random() * width : -60,
      y: fromTop ? -30 : Math.random() * height * 0.45,
      vx: 5.5 + Math.random() * 3,
      vy: 2.4 + Math.random() * 1.6,
      life: 1,
      len: 110 + Math.random() * 90
    });
  }

  function draw(now) {
    rafId = 0;
    if (!visible) return;
    rafId = requestAnimationFrame(draw);
    if (FRAME && now - lastDraw < FRAME) return;

    const dt = lastTime ? Math.min((now - lastTime) / 16.6, 2.5) : 1;
    lastTime = now;
    lastDraw = now;

    ctx.clearRect(0, 0, width, height);

    for (const mote of dust) {
      mote.y += mote.speed * dt;
      if (mote.y - mote.r > height) { mote.y = -mote.r; mote.x = Math.random() * width; }
      ctx.globalAlpha = mote.a;
      ctx.drawImage(sprite, mote.x - mote.r, mote.y - mote.r, mote.r * 2, mote.r * 2);
    }

    for (const star of stars) {
      star.y += star.speed * dt;
      star.twinkle += 0.03 * dt;
      if (star.y > height + 2) { star.y = -2; star.x = Math.random() * width; }
      ctx.globalAlpha = Math.max(0.08, star.a + Math.sin(star.twinkle) * 0.16);
      ctx.drawImage(sprite, star.x - star.s * 2.2, star.y - star.s * 2.2, star.s * 4.4, star.s * 4.4);
    }
    ctx.globalAlpha = 1;

    nextMeteor -= dt * 16.6;
    if (nextMeteor <= 0) {
      spawnMeteor();
      nextMeteor = 4200 + Math.random() * 6000;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.life -= 0.006 * dt;
      if (meteor.life <= 0 || meteor.x > width + 120 || meteor.y > height + 120) {
        meteors.splice(i, 1);
        continue;
      }
      const tailX = meteor.x - meteor.vx * (meteor.len / 7);
      const tailY = meteor.y - meteor.vy * (meteor.len / 7);
      const gradient = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(190, 235, 255, ${0.75 * meteor.life})`);
      gradient.addColorStop(0.35, `rgba(90, 180, 255, ${0.28 * meteor.life})`);
      gradient.addColorStop(1, "rgba(60, 120, 200, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
  }

  const start = () => {
    if (!rafId) rafId = requestAnimationFrame(draw);
  };
  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  build();
  start();

  const onResize = debounce(() => {
    build();
    start();
  }, 200);
  window.addEventListener("resize", onResize);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (visible) {
      lastTime = 0;
      start();
    }
  });

  const hero = canvas.closest(".hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px" }
    ).observe(hero);
  }
}

/* ------------------------------------------------------------ параллакс -- */
function initParallax() {
  if (prefersReduced || !finePointer || liteMode) return;
  const hero = $(".hero");
  if (!hero) return;

  const layers = [
    { el: $(".hero__bg"), dx: -9, dy: -7 },
    { el: $(".hero__aurora"), dx: 14, dy: 10 }
  ].filter((layer) => layer.el);
  if (!layers.length) return;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let rafId = 0;
  let visible = true;

  const tick = () => {
    rafId = 0;
    if (!visible) return;
    x += (targetX - x) * 0.055;
    y += (targetY - y) * 0.055;
    for (const layer of layers) {
      layer.el.style.transform = `translate3d(${(x * layer.dx).toFixed(2)}px, ${(y * layer.dy).toFixed(2)}px, 0)`;
    }
    if (Math.abs(targetX - x) > 0.0005 || Math.abs(targetY - y) > 0.0005) {
      rafId = requestAnimationFrame(tick);
    }
  };
  const start = () => {
    if (!rafId && visible) rafId = requestAnimationFrame(tick);
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      start();
    },
    { passive: true }
  );

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        targetX = 0;
        targetY = 0;
      } else {
        start();
      }
    }).observe(hero);
  }
}

/* ------------------------------------------------------------------ boot -- */
export function initHero() {
  initStarfield();
  initParallax();
}
