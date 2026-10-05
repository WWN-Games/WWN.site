/* ============================================================================
   WWN — общий интерфейс: шапка, прогресс, scrollspy, reveal, год.
   Скрипт переживает View Transitions: инициализация на каждом astro:page-load.
   ============================================================================ */

import { debounce, prefersReducedMotion } from "../lib/utils";

const REVEAL = { threshold: 0, rootMargin: "0px" };
let revealObserver: IntersectionObserver | null = null;

function initYear(): void {
  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function initMobileNav(): void {
  const burger = document.querySelector<HTMLElement>("#burger");
  const mobileNav = document.querySelector<HTMLElement>("#mobileNav");
  if (!burger || !mobileNav || mobileNav.dataset.bound === "true") return;
  mobileNav.dataset.bound = "true";

  mobileNav.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) mobileNav.hidePopover();
  });
  mobileNav.addEventListener("toggle", (event) => {
    burger.setAttribute("aria-expanded", String((event as ToggleEvent).newState === "open"));
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
    if (event.matches) mobileNav.hidePopover();
  });
}

function initReveal(): void {
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

function initScroll(): void {
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
    window.addEventListener("resize", debounce(measureSpy, 150));
    document.fonts.ready.then(measureSpy).catch(() => {});
  }

  let maxScroll = 0;
  const measureScroll = () => {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };
  measureScroll();
  new ResizeObserver(measureScroll).observe(document.body);

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
  window.addEventListener("scroll", schedule, { passive: true });

  if (toTop && toTop.dataset.bound !== "true") {
    toTop.dataset.bound = "true";
    toTop.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  }
}

function boot(): void {
  initYear();
  initMobileNav();
  initScroll();
  initReveal();
}

document.addEventListener("astro:page-load", boot);
boot();
