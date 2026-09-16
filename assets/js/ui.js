/* ============================================================================
   WWN — инициализация интерфейса
   Шапка, мобильное меню, прогресс чтения, ссылки из конфига, появление блоков.
   ============================================================================ */

import { $, $$, prefersReduced } from "./utils.js";

/** Актуальный год в подвале — на всех страницах. */
export function initYear() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}
export function initHeader() {
  const header = $("#header");
  if (!header) return;

  const progress = $("#scrollProgress");

  const burger = $("#burger");
  const mobileNav = $("#mobileNav");
  if (burger && mobileNav) {
    const setOpen = (open) => {
      mobileNav.classList.toggle("is-open", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      mobileNav.inert = !open;
      document.body.classList.toggle("is-locked", open);
    };
    setOpen(false);
    burger.addEventListener("click", () => setOpen(!mobileNav.classList.contains("is-open")));
    $$("a", mobileNav).forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav.classList.contains("is-open")) {
        setOpen(false);
        burger.focus();
      }
    });
    window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  const spyTargets = $$("#mainNav a[href^='#']")
    .map((link) => ({ link, el: document.getElementById(link.getAttribute("href").slice(1)) }))
    .filter((target) => target.el);

  let spyOffsets = [];
  const measure = () => {
    spyOffsets = spyTargets.map((target) => ({ link: target.link, top: target.el.offsetTop }));
  };
  if (spyTargets.length) {
    measure();
    window.addEventListener("resize", measure);
    // тексты меняют высоту при смене языка и после загрузки шрифтов
    document.addEventListener("wwn:langchange", measure);
    document.fonts.ready.then(measure).catch(() => {});
  }

  const toTop = $("#toTop");

  // высота документа для прогресса: кэш, чтобы не читать scrollHeight в кадре скролла
  let maxScroll = 0;
  const measureScroll = () => {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };
  if (progress) {
    measureScroll();
    new ResizeObserver(measureScroll).observe(document.body);
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 18);

    if (progress) {
      progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0})`;
    }

    if (spyOffsets.length) {
      const position = y + window.innerHeight * 0.32;
      let current = null;
      for (const target of spyOffsets) if (target.top <= position) current = target;
      for (const target of spyOffsets) target.link.classList.toggle("is-active", target === current);
    }

    if (toTop) toTop.classList.toggle("is-visible", y > 700);
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });

  if (toTop) {
    toTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" })
    );
  }
}
export function resolveLinks(config) {
  const links = config?.links || {};
  $$("[data-link]").forEach((el) => {
    const url = links[el.getAttribute("data-link")];
    if (url) {
      el.setAttribute("href", url);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    } else if (["steam", "drive"].includes(el.getAttribute("data-link"))) {
      el.setAttribute("href", "#download");
    } else {
      // ссылки нет в конфиге — убираем кнопку целиком (или её пункт меню)
      const li = el.closest("li");
      if (li) li.remove();
      else el.remove();
    }
  });
  $$("[data-link-note]").forEach((el) => {
    el.style.display = links[el.getAttribute("data-link-note")] ? "none" : "";
  });
}
/* Единый эффект появления (главная, вики, база): стартует ровно на крае окна. */
const REVEAL = { threshold: 0, rootMargin: "0px" };

let revealObserver = null;

export function initReveal(root = document) {
  const els = $$("[data-reveal]", root).filter((el) => !el.classList.contains("is-in"));
  if (!els.length) return;

  if (prefersReduced) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  revealObserver ||= new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      });
    },
    REVEAL
  );
  els.forEach((el) => revealObserver.observe(el));
}
