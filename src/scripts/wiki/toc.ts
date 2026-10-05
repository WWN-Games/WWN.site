/* ============================================================================
   WWN — оглавление статьи: раскрытие на десктопе, scrollspy, переход к якорю.
   Скрипт переживает View Transitions: инициализация на каждом astro:page-load.
   ============================================================================ */

import { prefersReducedMotion } from "@/lib/utils";

const WIDE_QUERY = "(min-width: 1241px)";
const SPY_LINE = 120;

let cleanup: (() => void) | null = null;

/** Плавный переход к якорю при загрузке страницы (scroll-padding-top задаёт CSS). */
function scrollToHash(): void {
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(decodeURIComponent(raw));
  } catch {
    target = document.getElementById(raw);
  }
  if (!target) return;
  target.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function initToc(): void {
  cleanup?.();
  cleanup = null;

  const toc = document.querySelector<HTMLDetailsElement>(".article__toc");
  const body = document.querySelector<HTMLElement>(".article__body");

  /* На десктопе список раскрыт, на мобильных — свёрнут (высота в CSS). */
  if (toc) toc.open = window.matchMedia(WIDE_QUERY).matches;

  scrollToHash();

  if (!toc || !body) return;

  const links = [...toc.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
  const headings = [...body.querySelectorAll<HTMLElement>("h2, h3")].filter(
    (heading) => heading.id,
  );
  if (!links.length || !headings.length) return;

  let offsets: number[] = [];
  let ticking = false;

  const measure = (): void => {
    offsets = headings.map((heading) => heading.getBoundingClientRect().top + window.scrollY);
  };
  const update = (): void => {
    ticking = false;
    const line = window.scrollY + SPY_LINE;
    let current = 0;
    for (let index = 0; index < offsets.length; index += 1) {
      const offset = offsets[index];
      if (offset !== undefined && offset <= line) current = index;
    }
    links.forEach((link, index) => {
      link.classList.toggle("is-active", index === current);
    });
  };
  const schedule = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  const remeasure = (): void => {
    measure();
    schedule();
  };

  measure();
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", remeasure);
  document.fonts.ready.then(remeasure).catch(() => {});
  const observer = new ResizeObserver(remeasure);
  observer.observe(body);

  cleanup = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", remeasure);
    observer.disconnect();
  };
}

document.addEventListener("astro:page-load", initToc);
initToc();
