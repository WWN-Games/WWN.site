/* ============================================================================
   WWN — общие утилиты. SSR-безопасны: окружение проверяется лениво.
   ============================================================================ */

import type { Lang } from "./site";

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Устройство с курсором (мышь) — для дорогих hover-эффектов и параллакса. */
export function hasFinePointer(): boolean {
  return (
    typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/** Слабый/мобильный профиль: тач, мало ядер/памяти или узкий экран. */
export function isLiteMode(): boolean {
  if (typeof window === "undefined") return true;
  return (
    !hasFinePointer() ||
    (navigator.hardwareConcurrency ?? 8) <= 2 ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2 ||
    document.documentElement.clientWidth < 900
  );
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = lang === "en" ? "en-GB" : "ru-RU";
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, lang: Lang): string {
  const locale = lang === "en" ? "en-US" : "ru-RU";
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/* Поиск: свёртка регистра и диакритики посимвольно (1:1), поэтому длина строки
   не меняется и подсветка идёт по исходному тексту. */
const FOLD_GROUPS = [
  "aàáâãäåāăą",
  "cçćĉċč",
  "dďđ",
  "eèéêëēĕėęě",
  "gĝğġģ",
  "hĥħ",
  "iìíîïĩīĭįı",
  "jĵ",
  "kķ",
  "lĺļľŀł",
  "nñńņň",
  "oòóôõöøōŏő",
  "rŕŗř",
  "sśŝşš",
  "tţťŧ",
  "uùúûüũūŭůűų",
  "wŵ",
  "yýÿŷ",
  "zźżž",
];
const FOLD_MAP: Record<string, string> = {};
for (const group of FOLD_GROUPS) {
  const [base, ...rest] = [...group];
  if (!base) continue;
  for (const char of rest) FOLD_MAP[char] = base;
}
const FOLD_RE = new RegExp(`[${Object.keys(FOLD_MAP).join("")}]`, "g");
const DASH_RE = /[-\u2010-\u2015]/g;

export function foldSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(DASH_RE, " ")
    .replace(FOLD_RE, (char) => FOLD_MAP[char] ?? char);
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

const collators = new Map<string, Intl.Collator>();

export function collator(lang: Lang): Intl.Collator {
  const locale = lang === "en" ? "en" : "ru";
  let instance = collators.get(locale);
  if (!instance) {
    instance = new Intl.Collator(locale, { numeric: true });
    collators.set(locale, instance);
  }
  return instance;
}

/* Индекс для клавиатурной навигации по списку (стрелки, Home/End).
   axis: "y" — вверх/вниз, "x" — влево/вправо; wrap — по кругу. -1, если клавиша не наша. */
export function nextFocusIndex(
  items: HTMLElement[],
  event: KeyboardEvent,
  { wrap = true, axis = "y" }: { wrap?: boolean; axis?: "x" | "y" } = {},
): number {
  if (!items.length) return -1;
  const last = items.length - 1;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const [prevKey, nextKey] = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  if (event.key === nextKey) {
    if (index === -1) return 0;
    return wrap ? (index === last ? 0 : index + 1) : Math.min(index + 1, last);
  }
  if (event.key === prevKey) {
    if (index === -1) return last;
    return wrap ? (index === 0 ? last : index - 1) : Math.max(index - 1, 0);
  }
  if (event.key === "Home") return 0;
  if (event.key === "End") return last;
  return -1;
}

export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delay = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
