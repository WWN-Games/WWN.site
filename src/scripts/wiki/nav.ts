/* ============================================================================
   WWN — сайдбар вики: мобильный аккордеон и память свёрнутости разделов.
   Скрипт переживает View Transitions: инициализация на каждом astro:page-load.
   ============================================================================ */

const NAV_STATE_KEY = "wwn-wiki-nav";
const MOBILE_QUERY = "(max-width: 1040px)";

let resizeBound = false;

function readState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const state: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "boolean") state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
}

function writeState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

function isMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function applyGroupState(nav: HTMLElement, mobile: boolean): void {
  const state = readState();
  for (const group of nav.querySelectorAll<HTMLDetailsElement>(".wiki-nav__group")) {
    const id = group.dataset.section;
    if (!id) continue;
    group.open = mobile ? Boolean(group.querySelector("a.is-active")) : state[id] !== false;
  }
}

function initNav(): void {
  const nav = document.querySelector<HTMLElement>("#wikiNav");
  if (!nav) return;

  const toggle = document.querySelector<HTMLButtonElement>("#wikiNavToggle");
  const mobile = isMobile();

  applyGroupState(nav, mobile);
  for (const group of nav.querySelectorAll<HTMLDetailsElement>(".wiki-nav__group")) {
    const id = group.dataset.section;
    if (!id || group.dataset.bound === "true") continue;
    group.dataset.bound = "true";
    group.addEventListener("toggle", () => {
      if (isMobile()) return;
      const state = readState();
      state[id] = group.open;
      writeState(state);
    });
  }

  nav.classList.toggle("is-collapsed", mobile);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!mobile));
    if (toggle.dataset.bound !== "true") {
      toggle.dataset.bound = "true";
      toggle.addEventListener("click", () => {
        const collapsed = !nav.classList.contains("is-collapsed");
        nav.classList.toggle("is-collapsed", collapsed);
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    }
  }

  nav.querySelector<HTMLAnchorElement>("a.is-active")?.scrollIntoView({ block: "nearest" });

  if (!resizeBound) {
    resizeBound = true;
    window.matchMedia(MOBILE_QUERY).addEventListener("change", (event) => {
      const currentNav = document.querySelector<HTMLElement>("#wikiNav");
      const currentToggle = document.querySelector<HTMLButtonElement>("#wikiNavToggle");
      if (!currentNav) return;
      currentNav.classList.toggle("is-collapsed", event.matches);
      currentToggle?.setAttribute("aria-expanded", String(!event.matches));
      applyGroupState(currentNav, event.matches);
    });
  }
}

document.addEventListener("astro:page-load", initNav);
initNav();
