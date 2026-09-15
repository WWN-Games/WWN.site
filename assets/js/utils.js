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

export const prefersReduced =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Устройство с курсором (мышь) — для дорогих hover-эффектов и параллакса. */
export const finePointer =
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Слабый/мобильный профиль: тач или экономия трафика. */
export const liteMode =
  typeof window !== "undefined" &&
  (!finePointer ||
    (navigator.hardwareConcurrency || 8) <= 2 ||
    (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) ||
    document.documentElement.clientWidth < 900);

/* ------------------------------------------------------------- локализация -- */
/** Значение локализованного поля { ru, en } с фолбэком на ru/en. */
export const loc = (obj, lang) => (obj ? obj[lang] || obj.ru || obj.en || "" : "");

/** Локализованный объект целиком (например, { caption }) с фолбэком. */
export const locObj = (obj, lang, fallback = {}) => (obj ? obj[lang] || obj.ru || obj.en || fallback : fallback);

/* ------------------------------------------------------------------- DOM -- */
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

/* --------------------------------------------------------------- сервис -- */
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

export function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
