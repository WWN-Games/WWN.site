/* ============================================================================
   WWN — общий модуль интерфейса
   Базовые пути, хелперы, шапка, меню, появление блоков, прогресс, ссылки.
   ============================================================================ */

/** Корень сайта (работает и на GitHub Pages в подкаталоге). */
export const BASE = new URL("../../", import.meta.url);

/** Абсолютный URL от корня сайта: abs("data/units.json"). */
export const abs = (path) => new URL(path, BASE).href;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------- локализация -- */
export const formatDate = (iso, lang) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

export const formatNumber = (value, lang) =>
  new Intl.NumberFormat(lang === "en" ? "en-US" : "ru-RU").format(value);

/* ------------------------------------------------------------------ шапка -- */
export function initHeader() {
  const header = $("#header");
  if (!header) return;

  const progress = $("#scrollProgress") || $("#wikiProgress");

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 18);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
    }
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger");
  const mobileNav = $("#mobileNav");
  if (burger && mobileNav) {
    burger.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    });
    $$("a", mobileNav).forEach((link) =>
      link.addEventListener("click", () => {
        mobileNav.classList.remove("is-open");
        burger.classList.remove("is-open");
      })
    );
  }

  // подсветка активного пункта меню при скролле
  const spyLinks = $$("#mainNav a[href^='#']");
  const spyTargets = spyLinks
    .map((link) => ({ link, el: document.getElementById(link.getAttribute("href").slice(1)) }))
    .filter((target) => target.el);
  if (spyTargets.length) {
    const spy = () => {
      const position = window.scrollY + window.innerHeight * 0.32;
      let current = null;
      for (const target of spyTargets) if (target.el.offsetTop <= position) current = target;
      spyTargets.forEach((target) => target.link.classList.toggle("is-active", target === current));
    };
    spy();
    window.addEventListener("scroll", spy, { passive: true });
  }

  const toTop = $("#toTop");
  if (toTop) {
    toTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" })
    );
    const watch = () => toTop.classList.toggle("is-visible", window.scrollY > 700);
    watch();
    window.addEventListener("scroll", watch, { passive: true });
  }
}

/* ------------------------------------------------------------- ссылки конфига -- */
export function resolveLinks(config) {
  const links = config?.links || {};
  $$("[data-link]").forEach((el) => {
    const url = links[el.getAttribute("data-link")];
    if (url) {
      el.setAttribute("href", url);
      if (!el.hasAttribute("data-noblank")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
    } else if (["steam", "drive"].includes(el.getAttribute("data-link"))) {
      el.setAttribute("href", "#download");
    } else {
      el.closest("li")?.remove();
    }
  });
  $$("[data-link-note]").forEach((el) => {
    el.style.display = links[el.getAttribute("data-link-note")] ? "none" : "";
  });
}

/* ------------------------------------------------------- появление секций -- */
let revealObserver = null;

export function initReveal(root = document) {
  const els = $$("[data-reveal]", root);
  if (!els.length) return;

  if (prefersReduced || !("IntersectionObserver" in window)) {
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
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );
  els.forEach((el) => revealObserver.observe(el));
}
