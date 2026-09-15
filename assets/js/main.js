/* ============================================================================
   WWN — главная страница (ES-модуль)
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, getLang, t } from "./i18n.js";
import { $, $$, debounce, formatDate, formatNumber, loc, prefersReduced } from "./utils.js";
import { initHeader, initReveal, resolveLinks } from "./ui.js";

const cfg = WWN_CONFIG;

/* ------------------------------------------------------------- звездопад -- */
function initStarfield() {
  const canvas = $("#starfield");
  if (!canvas || prefersReduced) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
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
  window.addEventListener("resize", debounce(resize, 150));

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

  let running = !document.hidden;
  let last = 0;
  function frame(now) {
    if (!running) return;
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

  document.addEventListener("visibilitychange", () => {
    const next = !document.hidden;
    if (next && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
    running = next;
  });
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
  let running = !document.hidden;

  window.addEventListener("pointermove", (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function tick() {
    if (!running) return;
    x += (targetX - x) * 0.055;
    y += (targetY - y) * 0.055;
    for (const layer of layers) {
      const scale = layer.el.classList.contains("hero__bg") ? "scale(1.09) " : "";
      layer.el.style.transform = `${scale}translate3d(${x * layer.dx}px, ${y * layer.dy}px, 0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  document.addEventListener("visibilitychange", () => {
    const next = !document.hidden;
    if (next && !running) requestAnimationFrame(tick);
    running = next;
  });
}

/* --------------------------------------------------------------- счётчики -- */
let counterGen = 0;

const statKey = (el) => (el.nextElementSibling?.getAttribute("data-i18n") || "").replace("stats.", "");
const statTarget = (el) => cfg.stats?.[statKey(el)] ?? (Number(el.dataset.count) || 0);

/** Мгновенно показать актуальные значения (например, при смене языка). */
function syncStats(lang) {
  counterGen += 1;
  $$(".stat__num").forEach((el) => {
    el.textContent = formatNumber(statTarget(el), lang);
  });
}

function initCounters() {
  const counters = $$(".stat__num");
  if (!counters.length) return;
  const lang = getLang();

  if (prefersReduced || !("IntersectionObserver" in window)) {
    counters.forEach((el) => { el.textContent = formatNumber(statTarget(el), lang); });
    return;
  }

  const gen = counterGen;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target;
      const target = statTarget(el);
      const start = performance.now();
      const step = (now) => {
        if (gen !== counterGen) return;
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
      const caption = localized.caption || "";
      galleryItems.push({ src, caption });

      const figure = document.createElement("figure");
      figure.className = "gallery__item";
      if (item.wide) figure.classList.add("gallery__item--wide");
      if (item.tall) figure.classList.add("gallery__item--tall");
      figure.tabIndex = 0;
      figure.setAttribute("role", "button");
      figure.setAttribute("aria-label", caption);

      const img = document.createElement("img");
      img.src = src;
      img.alt = caption;
      img.loading = "lazy";
      img.decoding = "async";

      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;

      figure.append(img, figcaption);
      figure.addEventListener("click", () => openLightbox(i));
      figure.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(i);
        }
      });
      return figure;
    })
  );
}

function openLightbox(index) {
  if (!lightbox || !lightboxImage || !galleryItems.length) return;
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.caption;
  if (lightboxCaption) lightboxCaption.textContent = item.caption;
  if (!lightbox.open) lightbox.showModal();
}

function stepLightbox(direction) {
  if (!galleryItems.length) return;
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

      const meta = document.createElement("div");
      meta.className = "news__meta";

      const tagName = String(item.tag || "update").replace(/[^\w-]/g, "");
      const tag = document.createElement("span");
      tag.className = `tag${tagName !== "update" ? ` tag--${tagName}` : ""}`;
      tag.textContent = loc(cfg.newsTags?.[tagName], lang) || tagName;

      const time = document.createElement("time");
      time.dateTime = item.date || "";
      time.textContent = item.date ? formatDate(item.date, lang) : "";

      meta.append(tag, time);

      const title = document.createElement("h3");
      title.textContent = localized.title || "";
      const text = document.createElement("p");
      text.textContent = localized.text || "";

      card.append(meta, title, text);
      return card;
    })
  );
}

/* --------------------------------------------------------------------- FAQ -- */
function syncFaqHeights() {
  $$(".faq__item.is-open .faq__a").forEach((answer) => {
    answer.style.maxHeight = `${answer.scrollHeight}px`;
  });
}

function initFaq() {
  $$(".faq__item").forEach((item) => {
    const question = $(".faq__q", item);
    const answer = $(".faq__a", item);
    if (!question || !answer) return;

    const setOpen = (open) => {
      item.classList.toggle("is-open", open);
      question.setAttribute("aria-expanded", String(open));
      answer.inert = !open;
      answer.setAttribute("aria-hidden", String(!open));
      answer.style.maxHeight = open ? `${answer.scrollHeight}px` : "";
    };

    setOpen(false);
    question.addEventListener("click", () => {
      const wasOpen = item.classList.contains("is-open");
      $$(".faq__item").forEach((other) => {
        if (other === item) return;
        other.classList.remove("is-open");
        $(".faq__q", other)?.setAttribute("aria-expanded", "false");
        const otherAnswer = $(".faq__a", other);
        if (otherAnswer) {
          otherAnswer.style.maxHeight = "";
          otherAnswer.inert = true;
          otherAnswer.setAttribute("aria-hidden", "true");
        }
      });
      setOpen(!wasOpen);
    });
  });
}

/* ------------------------------------------------------------------- boot -- */
function refreshDynamic(lang) {
  renderGallery(lang);
  renderNews(lang);
  syncFaqHeights();
  document.title = t("meta.title.home", lang);
}

function boot() {
  const lang = bootI18n();
  initHeader();
  resolveLinks(cfg);
  initStarfield();
  initParallax();
  initCounters();
  initGalleryUi();
  initFaq();
  initReveal();
  refreshDynamic(lang);

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  document.addEventListener("wwn:langchange", (event) => {
    refreshDynamic(event.detail.lang);
    syncStats(event.detail.lang);
  });
  window.addEventListener("resize", debounce(syncFaqHeights, 150));
}

boot();
