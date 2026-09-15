/* ============================================================================
   WWN — главная страница (ES-модуль)
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { getLang, t, bootI18n, initLangSwitch, setPageTitle } from "./i18n.js";
import { $, $$, formatDate, formatNumber, prefersReduced, initHeader, initReveal, resolveLinks } from "./ui.js";

const cfg = WWN_CONFIG;

/* ------------------------------------------------------------- звездопад -- */
function initStarfield() {
  const canvas = $("#starfield");
  if (!canvas || prefersReduced) return;
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let stars = [];
  let dust = [];
  let meteors = [];
  let nextMeteor = 1600;

  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const spriteCtx = sprite.getContext("2d");
  const glow = spriteCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgba(150, 210, 255, 0.5)");
  glow.addColorStop(0.45, "rgba(90, 160, 240, 0.16)");
  glow.addColorStop(1, "rgba(60, 120, 200, 0)");
  spriteCtx.fillStyle = glow;
  spriteCtx.fillRect(0, 0, 64, 64);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.round((w * h) / 7600);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.25,
      a: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.14 + 0.025,
      twinkle: Math.random() * Math.PI * 2
    }));
    dust = Array.from({ length: Math.max(14, Math.round(count / 6)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 26 + 10,
      a: Math.random() * 0.07 + 0.03,
      speed: Math.random() * 0.22 + 0.05,
      dx: (Math.random() - 0.5) * 0.18
    }));
    meteors = [];
  }
  resize();
  window.addEventListener("resize", resize);

  function spawnMeteor(w, h) {
    const fromTop = Math.random() > 0.35;
    meteors.push({
      x: fromTop ? Math.random() * w : -60,
      y: fromTop ? -30 : Math.random() * h * 0.45,
      vx: 5.5 + Math.random() * 3,
      vy: 2.4 + Math.random() * 1.6,
      life: 1,
      len: 110 + Math.random() * 90
    });
  }

  let last = 0;
  function frame(now) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const dt = Math.min((now - last) / 16.6, 3);
    last = now;

    for (const mote of dust) {
      mote.y += mote.speed * dt;
      mote.x += mote.dx * dt;
      if (mote.y - mote.r > h) { mote.y = -mote.r; mote.x = Math.random() * w; }
      if (mote.x - mote.r > w) mote.x = -mote.r;
      if (mote.x + mote.r < 0) mote.x = w + mote.r;
      ctx.globalAlpha = mote.a;
      ctx.drawImage(sprite, mote.x - mote.r, mote.y - mote.r, mote.r * 2, mote.r * 2);
    }
    ctx.globalAlpha = 1;

    for (const star of stars) {
      star.y += star.speed * dt;
      star.twinkle += 0.028 * dt;
      if (star.y > h + 2) { star.y = -2; star.x = Math.random() * w; }
      const alpha = star.a + Math.sin(star.twinkle) * 0.18;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${star.r > 1.1 ? "150,215,255" : "225,238,255"},${Math.max(alpha, 0.05)})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    nextMeteor -= dt * 16.6;
    if (nextMeteor <= 0) {
      spawnMeteor(w, h);
      nextMeteor = 4200 + Math.random() * 6000;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.life -= 0.006 * dt;
      if (meteor.life <= 0 || meteor.x > w + 120 || meteor.y > h + 120) { meteors.splice(i, 1); continue; }
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

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------- параллакс -- */
function initParallax() {
  if (prefersReduced) return;
  const layers = [
    { el: $(".hero__bg"), dx: -11, dy: -8 },
    { el: $(".hero__aurora"), dx: 16, dy: 12 },
    { el: $(".hero__rays"), dx: 22, dy: 14 },
    { el: $("#starfield"), dx: 6, dy: 5 }
  ].filter((layer) => layer.el);
  if (!layers.length) return;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  window.addEventListener("pointermove", (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function tick() {
    x += (targetX - x) * 0.055;
    y += (targetY - y) * 0.055;
    for (const layer of layers) {
      const scale = layer.el.classList.contains("hero__bg") ? "scale(1.09) " : "";
      layer.el.style.transform = `${scale}translate3d(${x * layer.dx}px, ${y * layer.dy}px, 0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* --------------------------------------------------------------- счётчики -- */
const statKey = (el) => (el.nextElementSibling?.getAttribute("data-i18n") || "").replace("stats.", "");

function syncStats(lang) {
  $$(".stat__num").forEach((el) => {
    const key = statKey(el);
    const value = cfg.stats?.[key] ?? (Number(el.dataset.count) || 0);
    el.dataset.count = String(value);
    el.textContent = formatNumber(value, lang);
  });
}

function initCounters() {
  const counters = $$(".stat__num");
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count) || 0;
      const lang = getLang();
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / 1400, 1);
        el.textContent = formatNumber(Math.round(target * (1 - (1 - progress) ** 3)), lang);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  counters.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------------- галерея -- */
const lightbox = $("#lightbox");
const lightboxImage = $("#lbImg");
const lightboxCaption = $("#lbCap");
let galleryItems = [];
let galleryIndex = 0;

function renderGallery(lang) {
  const grid = $("#galleryGrid");
  if (!grid) return;

  const items = cfg.gallery || [];
  const section = grid.closest("section");
  if (!items.length) {
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;

  galleryItems = [];
  grid.replaceChildren(
    ...items.map((item, i) => {
      const localized = item[lang] || item.ru || item.en || {};
      const src = lang === "en" && item.srcEn ? item.srcEn : item.src;
      galleryItems.push({ src, caption: localized.caption || "" });

      const figure = document.createElement("figure");
      figure.className = "gallery__item";
      if (item.wide) figure.classList.add("gallery__item--wide");
      if (item.tall) figure.classList.add("gallery__item--tall");

      const img = document.createElement("img");
      img.src = src;
      img.alt = localized.caption || "";
      img.loading = "lazy";
      img.decoding = "async";

      const caption = document.createElement("figcaption");
      caption.textContent = localized.caption || "";

      figure.append(img, caption);
      figure.addEventListener("click", () => openLightbox(i));
      return figure;
    })
  );
}

function openLightbox(index) {
  if (!lightbox || !galleryItems.length) return;
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.caption;
  lightboxCaption.textContent = item.caption;
  if (!lightbox.open) lightbox.showModal();
}

function stepLightbox(direction) {
  openLightbox(galleryIndex + direction);
}

function initGalleryUi() {
  if (!lightbox) return;
  $("#lbClose")?.addEventListener("click", () => lightbox.close());
  $("#lbPrev")?.addEventListener("click", () => stepLightbox(-1));
  $("#lbNext")?.addEventListener("click", () => stepLightbox(1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") stepLightbox(-1);
    if (event.key === "ArrowRight") stepLightbox(1);
  });
}

/* ------------------------------------------------------------------ новости -- */
function renderNews(lang) {
  const grid = $("#newsGrid");
  if (!grid) return;
  grid.replaceChildren(
    ...(cfg.news || []).map((item) => {
      const localized = item[lang] || item.ru || {};
      const card = document.createElement("article");
      card.className = "news__card";
      const tagClass = item.tag && item.tag !== "update" ? ` tag--${item.tag}` : "";
      card.innerHTML =
        `<div class="news__meta">
           <span class="tag${tagClass}">${t(`news.tag.${item.tag || "update"}`, lang)}</span>
           <time datetime="${item.date}">${formatDate(item.date, lang)}</time>
         </div>
         <h3></h3><p></p>`;
      card.querySelector("h3").textContent = localized.title || "";
      card.querySelector("p").textContent = localized.text || "";
      return card;
    })
  );
}

/* --------------------------------------------------------------------- FAQ -- */
function initFaq() {
  $$(".faq__item").forEach((item) => {
    const question = $(".faq__q", item);
    const answer = $(".faq__a", item);
    question?.addEventListener("click", () => {
      const wasOpen = item.classList.contains("is-open");
      $$(".faq__item").forEach((other) => {
        other.classList.remove("is-open");
        const otherAnswer = $(".faq__a", other);
        if (otherAnswer) otherAnswer.style.maxHeight = "";
      });
      if (!wasOpen) {
        item.classList.add("is-open");
        answer.style.maxHeight = `${answer.scrollHeight}px`;
      }
    });
  });
}

/* ------------------------------------------------------------------- boot -- */
let currentLang = getLang();

function refreshDynamic(lang) {
  currentLang = lang;
  syncStats(lang);
  renderGallery(lang);
  renderNews(lang);
  setPageTitle(t("meta.title.home", lang), t("meta.title.home", lang), lang);
}

function boot() {
  const lang = bootI18n();
  initHeader();
  initLangSwitch();
  resolveLinks(cfg);
  initStarfield();
  initParallax();
  syncStats(lang);
  initCounters();
  initGalleryUi();
  initFaq();
  initReveal();
  refreshDynamic(lang);

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  document.addEventListener("wwn:langchange", (event) => refreshDynamic(event.detail.lang));
}

boot();
