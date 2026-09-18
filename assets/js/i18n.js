/* ============================================================================
   WWN — локализация интерфейса (RU / EN). Движок + общие строки.
   ----------------------------------------------------------------------------
   Страничные словари — assets/js/i18n/<page>.ru.js / <page>.en.js; грузится
   только активный язык, которому в <head> заранее ставится modulepreload:
     registerDictLoaders({ ru: () => import("./i18n/home.ru.js"), en: ... });
   В разметке: data-i18n, -html, -placeholder, -title, -aria, -alt, -content.
   Язык страницы: ?lang= → выбор пользователя (localStorage) → язык браузера.
   Переключение: «побеждает последний клик» (словарь догружается асинхронно),
   URL и canonical/hreflang обновляются на месте через replaceState.
   В HTML текстов нет — только пустые привязки: единственный источник строк — словари.
   (Сайт рассчитан на работу с JS: подложек для no-JS в разметке не держим.)
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { $$ } from "./utils.js";

const LANG_KEY = "wwn-lang";
const LANGS = ["ru", "en"];
const CORE_I18N = {
  ru: {
    "nav.home": "Главная",
    "nav.features": "Возможности",
    "nav.factions": "Фракции",
    "nav.gallery": "Галерея",
    "nav.news": "Новости",
    "nav.wiki": "Вики",
    "nav.download": "Скачать",
    "nav.faq": "FAQ",
    "database.title": "База данных",
    "brand.sub": "Мод для Rusted Warfare",
    "siteTagline": "WWN — мод для Rusted Warfare с космическими флотами и масштабными наземными сражениями.",
    "footer.nav": "Навигация",
    "footer.community": "Сообщество",
    "footer.download": "Скачать",
    "footer.disclaimer": "Официальный сайт мода WWN для Rusted Warfare. Rusted Warfare © Corroding Games. Все материалы мода принадлежат команде WWN.",
    "footer.backToTop": "Наверх",
    "meta.title.home": "WWN — официальный сайт мода для Rusted Warfare | Скачать, вики, лор",
    "meta.title.wiki": "Вики WWN",
    "meta.title.wikiHome": "Вики WWN — лор, фракции, юниты, механики и гайды",
    "meta.title.database": "База данных WWN — фракции, юниты и строения",
    "notfound.title": "404 — потерялись в космосе",
    "notfound.desc": "Такой страницы здесь нет. Возможно, она улетела на дальнюю орбиту.",
    "notfound.home": "На главную",
    "notfound.wiki": "В вики",
    "notfound.article.title": "Статья ещё не написана",
    "notfound.article.desc": "Эта страница задумана, но текста пока нет. Можно вернуться в вики или открыть исходник и написать её.",
    "notfound.article.create": "Создать статью на GitHub",
    "a11y.skip": "К содержимому",
    "a11y.nav": "Основная навигация",
    "a11y.lang": "Язык",
    "a11y.menu": "Меню",
    "a11y.gallery": "Галерея"
  },
  en: {
    "nav.home": "Home",
    "nav.features": "Features",
    "nav.factions": "Factions",
    "nav.gallery": "Gallery",
    "nav.news": "News",
    "nav.wiki": "Wiki",
    "nav.download": "Download",
    "nav.faq": "FAQ",
    "database.title": "Database",
    "brand.sub": "A Rusted Warfare mod",
    "siteTagline": "WWN — a mod for Rusted Warfare featuring space fleets and large-scale ground battles.",
    "footer.nav": "Navigation",
    "footer.community": "Community",
    "footer.download": "Download",
    "footer.disclaimer": "Official website of the WWN mod for Rusted Warfare. Rusted Warfare © Corroding Games. All mod materials belong to the WWN team.",
    "footer.backToTop": "Back to top",
    "meta.title.home": "WWN — official mod site for Rusted Warfare | Download, wiki, lore",
    "meta.title.wiki": "WWN Wiki",
    "meta.title.wikiHome": "WWN Wiki — lore, factions, units, mechanics and guides",
    "meta.title.database": "WWN Database — factions, units and structures",
    "notfound.title": "404 — lost in space",
    "notfound.desc": "This page doesn't exist. It probably drifted to a far orbit.",
    "notfound.home": "Go home",
    "notfound.wiki": "Open the wiki",
    "notfound.article.title": "Article not written yet",
    "notfound.article.desc": "This page is planned, but there is no text yet. Go back to the wiki or open the source and write it.",
    "notfound.article.create": "Create the article on GitHub",
    "a11y.skip": "Skip to content",
    "a11y.nav": "Main navigation",
    "a11y.lang": "Language",
    "a11y.menu": "Menu",
    "a11y.gallery": "Gallery"
  }
};

const dicts = { ru: { ...CORE_I18N.ru }, en: { ...CORE_I18N.en } };
const pageLoaded = { ru: false, en: false };
const pageLoaders = { ru: null, en: null };

/* Язык, применённый к странице. Пока null — страница ещё не инициализирована. */
let currentLang = null;
/* Токен переключений: словари грузятся асинхронно, применяем только последний выбор. */
let switchSeq = 0;

/** Зарегистрировать ленивые загрузчики словаря страницы: { ru: () => import(...), en: ... }. */
export function registerDictLoaders(loaders) {
  for (const lang of LANGS) {
    if (typeof loaders[lang] === "function") pageLoaders[lang] = loaders[lang];
  }
}

async function ensureDict(lang) {
  if (pageLoaded[lang] || !pageLoaders[lang]) return;
  const mod = await pageLoaders[lang]();
  Object.assign(dicts[lang], mod.DICT);
  pageLoaded[lang] = true;
}

/** Язык страницы: ?lang= → выбор пользователя → язык браузера. */
export function getLang() {
  const param = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(param)) return param;
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(stored)) return stored;
  } catch {}
  return (navigator.language || "ru").slice(0, 2).toLowerCase() === "ru" ? "ru" : "en";
}

/** Синхронизировать ?lang= в адресной строке с выбранным языком. */
function syncUrlLang(lang) {
  const url = new URL(location.href);
  if (lang === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  if (url.href !== location.href) {
    try { history.replaceState(null, "", url); } catch {}
  }
}

/** canonical/og:url/hreflang/og:locale — под текущий язык и текущий URL страницы. */
function applyMeta(lang) {
  const url = new URL(location.href);
  url.hash = "";
  if (lang === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");

  const setContent = (selector, value) => document.querySelector(selector)?.setAttribute("content", value);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", url.href);
  setContent('meta[property="og:url"]', url.href);
  setContent('meta[property="og:locale"]', lang === "en" ? "en_US" : "ru_RU");
  setContent('meta[property="og:locale:alternate"]', lang === "en" ? "ru_RU" : "en_US");

  $$('link[rel="alternate"][hreflang]').forEach((link) => {
    const target = new URL(url);
    if (link.getAttribute("hreflang") === "en") target.searchParams.set("lang", "en");
    else target.searchParams.delete("lang");
    link.setAttribute("href", target.href);
  });
}

/** Применить язык к документу: атрибут lang, привязки, мета, событие. */
function commitLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  applyI18n(lang);
  applyMeta(lang);
  document.dispatchEvent(new CustomEvent("wwn:langchange", { detail: { lang } }));
}

/** Переключить язык: последний клик побеждает, даже если словарь ещё грузится. */
export async function setLang(lang) {
  if (!LANGS.includes(lang) || lang === currentLang) return;
  const seq = ++switchSeq;
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
  try { await ensureDict(lang); } catch {}
  if (seq !== switchSeq) return;
  syncUrlLang(lang);
  commitLang(lang);
}

export function t(key, lang, vars) {
  const dict = dicts[lang || getLang()] || dicts.ru;
  let value = dict[key];
  if (value === undefined) value = CORE_I18N.ru[key];
  if (value === undefined) return key;
  const params = { version: WWN_CONFIG.version || "", ...vars };
  return value.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? params[name] : match));
}

export function applyI18n(lang = getLang()) {
  $$("[data-i18n], [data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n") || el.getAttribute("data-i18n-html");
    const value = t(key, lang);
    if (el.hasAttribute("data-i18n-html")) el.innerHTML = value;
    else el.textContent = value;
  });
  $$("[data-i18n-placeholder]").forEach((el) =>
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"), lang))
  );
  $$("[data-i18n-title]").forEach((el) =>
    el.setAttribute("title", t(el.getAttribute("data-i18n-title"), lang))
  );
  $$("[data-i18n-aria]").forEach((el) =>
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"), lang))
  );
  $$("[data-i18n-alt]").forEach((el) =>
    el.setAttribute("alt", t(el.getAttribute("data-i18n-alt"), lang))
  );
  $$("[data-i18n-content]").forEach((el) =>
    el.setAttribute("content", t(el.getAttribute("data-i18n-content"), lang))
  );
  $$("[data-lang-btn]").forEach((el) => {
    const active = el.getAttribute("data-lang-btn") === (lang === "ru" ? "RU" : "EN");
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-pressed", String(active));
  });
}
let langSwitchBound = false;

export function initLangSwitch() {
  if (langSwitchBound) return;
  langSwitchBound = true;
  $$("[data-lang-btn]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setLang(btn.getAttribute("data-lang-btn").toLowerCase()).catch(() => {});
    })
  );
}

/** Подписка на смену языка: handler(lang) вызывается один раз на переключение. */
export function onLangChange(handler) {
  document.addEventListener("wwn:langchange", (event) => handler(event.detail.lang));
}

/** Стартовая локализация страницы: догружает словарь активного языка. */
export async function bootI18n() {
  const lang = getLang();
  const seq = ++switchSeq;
  try { await ensureDict(lang); } catch {}
  if (seq === switchSeq && currentLang !== lang) {
    syncUrlLang(lang);
    commitLang(lang);
  }
  initLangSwitch();
  return currentLang || lang;
}
