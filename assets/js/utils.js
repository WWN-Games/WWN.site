/* ============================================================================
   WWN — общие утилиты (ES-модуль)
   Чистые хелперы без DOM-инициализации: пути, выборки, форматирование,
   локализация данных, экранирование, debounce.
   ============================================================================ */

/** Корень сайта (работает и на GitHub Pages в подкаталоге). */
const BASE = new URL("../../", import.meta.url);

/** Абсолютный URL от корня сайта: abs("data/units.json"). */
export const abs = (path) => new URL(path, BASE).href;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Устройство с курсором (мышь) — для дорогих hover-эффектов и параллакса. */
export const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Слабый/мобильный профиль: тач или экономия трафика. */
export const liteMode =
  !finePointer ||
  navigator.hardwareConcurrency <= 2 ||
  navigator.deviceMemory <= 2 ||
  document.documentElement.clientWidth < 900;
/** Значение локализованного поля { ru, en } с фолбэком на ru/en. */
export const loc = (obj, lang) => (obj ? obj[lang] || obj.ru || obj.en || "" : "");

/** Локализованный объект целиком (например, { caption }) с фолбэком. */
export const locObj = (obj, lang, fallback = {}) => (obj ? obj[lang] || obj.ru || obj.en || fallback : fallback);
/** Пустой блок-сообщение («ничего не найдено» и т.п.). */
export function emptyBlock(text, className = "empty-block") {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  return div;
}

const dateFormatters = new Map();
export const formatDate = (iso, lang) => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = lang === "en" ? "en-GB" : "ru-RU";
  if (!dateFormatters.has(locale)) {
    dateFormatters.set(locale, new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }));
  }
  return dateFormatters.get(locale).format(date);
};

const numberFormatters = new Map();
export const formatNumber = (value, lang) => {
  const locale = lang === "en" ? "en-US" : "ru-RU";
  if (!numberFormatters.has(locale)) numberFormatters.set(locale, new Intl.NumberFormat(locale));
  return numberFormatters.get(locale).format(value);
};
/* Поиск: свёртка регистра и диакритики выполняется посимвольно (1:1),
   поэтому длина строки не меняется и подсветка идёт по исходному тексту. */
const FOLD_GROUPS = [
  "aàáâãäåāăą", "cçćĉċč", "dďđ", "eèéêëēĕėęě", "gĝğġģ", "hĥħ",
  "iìíîïĩīĭįı", "jĵ", "kķ", "lĺļľŀł", "nñńņň", "oòóôõöøōŏő",
  "rŕŗř", "sśŝşš", "tţťŧ", "uùúûüũūŭůűų", "wŵ", "yýÿŷ", "zźżž"
];
const FOLD_MAP = {};
for (const group of FOLD_GROUPS) {
  const [base, ...rest] = [...group];
  for (const char of rest) FOLD_MAP[char] = base;
}
const FOLD_RE = new RegExp(`[${Object.keys(FOLD_MAP).join("")}]`, "g");

/** Свёртка текста для поиска: регистр, ё→е, латинская диакритика. */
export const foldSearch = (text) =>
  String(text).toLowerCase().replace(/ё/g, "е").replace(FOLD_RE, (char) => FOLD_MAP[char]);

/* Формы слова по числу: plural(lang, n, { one, few, many, other }). */
const pluralRules = new Map();
export function plural(lang, n, forms) {
  const locale = lang === "en" ? "en" : "ru";
  if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(locale));
  const category = pluralRules.get(locale).select(n);
  return forms[category] ?? forms.other ?? "";
}

/** Экранирование текста для вставки в HTML. */
export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

/** Цвет из данных — только валидный hex, иначе фолбэк. */
export const safeColor = (value, fallback) =>
  typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : fallback;

const collators = new Map();
/** Кэшированный коллатор языка сайта — для сортировки названий. */
export const collator = (lang) => {
  const locale = lang === "en" ? "en" : "ru";
  if (!collators.has(locale)) collators.set(locale, new Intl.Collator(locale, { numeric: true }));
  return collators.get(locale);
};

/* Индекс для клавиатурной навигации по списку (стрелки, Home/End).
   axis: "y" — вверх/вниз, "x" — влево/вправо; wrap — по кругу. -1, если клавиша не наша. */
export function nextFocusIndex(items, event, { wrap = true, axis = "y" } = {}) {
  if (!items.length) return -1;
  const last = items.length - 1;
  const index = items.indexOf(document.activeElement);
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

export function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
