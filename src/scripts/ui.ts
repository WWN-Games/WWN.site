/* ============================================================================
   WWN — общий интерфейс: шапка, прогресс, scrollspy, reveal, год.
   Скрипт переживает View Transitions: на каждом astro:page-load старые
   обработчики и observers отменяются, затем создаются новые.
   ============================================================================ */

import { debounce, prefersReducedMotion } from "../lib/utils";

const REVEAL = { threshold: 0, rootMargin: "0px" };
let revealObserver: IntersectionObserver | null = null;
let cleanup: (() => void) | null = null;

function initYear(): void {
  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

/** Плашка «Новинка!» исчезает по дате без пересборки сайта. */
function initNewBadges(): void {
  const today = new Date().toISOString().slice(0, 10);
  for (const badge of document.querySelectorAll<HTMLElement>("[data-new-until]")) {
    const until = badge.dataset.newUntil;
    if (until && until < today) badge.remove();
  }
}

function initMobileNav(signal: AbortSignal): void {
  const burger = document.querySelector<HTMLElement>("#burger");
  const mobileNav = document.querySelector<HTMLElement>("#mobileNav");
  if (!burger || !mobileNav) return;

  mobileNav.addEventListener(
    "click",
    (event) => {
      if ((event.target as HTMLElement).closest("a")) mobileNav.hidePopover();
    },
    { signal },
  );
  mobileNav.addEventListener(
    "toggle",
    (event) => {
      burger.setAttribute("aria-expanded", String((event as ToggleEvent).newState === "open"));
    },
    { signal },
  );
  window.matchMedia("(min-width: 901px)").addEventListener(
    "change",
    (event) => {
      if (event.matches) mobileNav.hidePopover();
    },
    { signal },
  );
}

function initReveal(): void {
  document.documentElement.classList.add("reveal-ready");
  const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(
    (element) => !element.classList.contains("is-in"),
  );
  if (!elements.length) return;

  if (prefersReducedMotion()) {
    for (const element of elements) element.classList.add("is-in");
    return;
  }

  revealObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      revealObserver?.unobserve(entry.target);
    }
  }, REVEAL);

  for (const element of elements) revealObserver.observe(element);
}

function initScroll(signal: AbortSignal): void {
  const header = document.querySelector("#header");
  if (!header) return;

  const progress = document.querySelector<HTMLElement>("#scrollProgress");
  const toTop = document.querySelector<HTMLElement>("#toTop");

  const spyTargets = [
    ...document.querySelectorAll<HTMLAnchorElement>("#mainNav a[href^='#']"),
  ].flatMap((link) => {
    const id = link.getAttribute("href")?.slice(1);
    const element = id ? document.getElementById(id) : null;
    return element ? [{ link, element }] : [];
  });

  let spyOffsets: { link: HTMLAnchorElement; top: number }[] = [];
  const measureSpy = () => {
    spyOffsets = spyTargets.map((target) => ({ link: target.link, top: target.element.offsetTop }));
  };
  if (spyTargets.length) {
    measureSpy();
    const remeasure = debounce(measureSpy, 150);
    window.addEventListener("resize", remeasure, { signal });
    signal.addEventListener("abort", remeasure.cancel, { once: true });
    document.fonts.ready
      .then(() => {
        if (!signal.aborted) measureSpy();
      })
      .catch(() => {});
  }

  let maxScroll = 0;
  const measureScroll = () => {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };
  measureScroll();
  const resizeObserver = new ResizeObserver(measureScroll);
  resizeObserver.observe(document.body);
  signal.addEventListener("abort", () => resizeObserver.disconnect(), { once: true });

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
      let current: { link: HTMLAnchorElement; top: number } | null = null;
      for (const target of spyOffsets) if (target.top <= position) current = target;
      for (const target of spyOffsets)
        target.link.classList.toggle("is-active", target === current);
    }

    if (toTop) toTop.classList.toggle("is-visible", y > Math.min(700, maxScroll * 0.5));
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true, signal });

  if (toTop) {
    toTop.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      },
      { signal },
    );
  }
}

function boot(): void {
  cleanup?.();

  const controller = new AbortController();
  const { signal } = controller;

  initYear();
  initNewBadges();
  initMobileNav(signal);
  initScroll(signal);
  initReveal();

  cleanup = () => {
    controller.abort();
    revealObserver?.disconnect();
    revealObserver = null;
  };
}

document.addEventListener("astro:before-swap", () => {
  cleanup?.();
  cleanup = null;
});
document.addEventListener("astro:page-load", boot);
boot();
