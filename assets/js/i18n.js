/* ============================================================================
   WWN — локализация интерфейса (RU / EN). Движок + общие строки.
   ----------------------------------------------------------------------------
   Страничные словари лежат в assets/js/i18n/*.js и подключаются на странице:
     registerI18n(HOME_I18N) — до вызова bootI18n().
   В разметке: data-i18n="ключ", data-i18n-html / -placeholder / -title / -aria.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { $$ } from "./utils.js";

const LANG_KEY = "wwn-lang";

/* -------------------------- общие строки: шапка, подвал, метатеги, 404 -- */
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
    "siteTagline": "Мод WWN для Rusted Warfare. Космические флоты, наземные сражения и живая лига игроков.",
    "footer.nav": "Навигация",
    "footer.community": "Сообщество",
    "footer.download": "Скачать",
    "footer.disclaimer": "Официальный сайт мода WWN для Rusted Warfare. Rusted Warfare © Corroding Games.",
    "footer.rights": "Все материалы мода принадлежат команде WWN.",
    "footer.backToTop": "Наверх",
    "meta.title.home": "WWN — официальный сайт мода для Rusted Warfare | Скачать, вики, лор",
    "meta.title.wiki": "Вики WWN",
    "meta.title.wikiHome": "Вики WWN — лор, фракции, юниты, механики и гайды",
    "meta.title.database": "База данных WWN — фракции, юниты и строения",
    "notfound.title": "404 — потерялись в космосе",
    "notfound.desc": "Такой страницы здесь нет. Возможно, она улетела на дальнюю орбиту.",
    "notfound.home": "На главную",
    "notfound.wiki": "В вики"
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
    "siteTagline": "The WWN mod for Rusted Warfare. Space fleets, ground battles and a living players' league.",
    "footer.nav": "Navigation",
    "footer.community": "Community",
    "footer.download": "Download",
    "footer.disclaimer": "Official website of the WWN mod for Rusted Warfare. Rusted Warfare © Corroding Games.",
    "footer.rights": "All mod materials belong to the WWN team.",
    "footer.backToTop": "Back to top",
    "meta.title.home": "WWN — official mod site for Rusted Warfare | Download, wiki, lore",
    "meta.title.wiki": "WWN Wiki",
    "meta.title.wikiHome": "WWN Wiki — lore, factions, units, mechanics and guides",
    "meta.title.database": "WWN Database — factions, units and structures",
    "notfound.title": "404 — lost in space",
    "notfound.desc": "This page doesn't exist. It probably drifted to a far orbit.",
    "notfound.home": "Go home",
    "notfound.wiki": "Open the wiki"
  }
};

const dicts = { ru: { ...CORE_I18N.ru }, en: { ...CORE_I18N.en } };

/** Добавить строки страницы в общий словарь (ru/en). */
export function registerI18n(dict) {
  if (!dict) return;
  for (const lang of ["ru", "en"]) {
    if (dict[lang]) Object.assign(dicts[lang], dict[lang]);
  }
}

/* ------------------------------------------------------------------ язык -- */
export function getLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && dicts[stored]) return stored;
  } catch {}
  const nav = (navigator.language || "ru").slice(0, 2).toLowerCase();
  return nav === "ru" ? "ru" : "en";
}

function setLang(lang) {
  if (!dicts[lang] || document.documentElement.lang === lang) return;
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
  document.documentElement.lang = lang;
  applyI18n(lang);
  document.dispatchEvent(new CustomEvent("wwn:langchange", { detail: { lang } }));
}

/* -------------------------------------------------------------- переводы -- */
export function t(key, lang, vars) {
  const dict = dicts[lang || getLang()] || dicts.ru;
  let value = dict[key];
  if (value === undefined) value = CORE_I18N.ru[key];
  if (value === undefined) return key;
  const params = { version: WWN_CONFIG.version || "", ...vars };
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
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
  $$("[data-lang-btn]").forEach((el) => {
    el.classList.toggle("is-active", el.getAttribute("data-lang-btn") === (lang === "ru" ? "RU" : "EN"));
  });
}

/* --------------------------------------------------- переключатель языка -- */
let langSwitchBound = false;

export function initLangSwitch() {
  if (langSwitchBound) return;
  langSwitchBound = true;
  $$("[data-lang-btn]").forEach((btn) =>
    btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang-btn").toLowerCase()))
  );
}

/** Подписка на смену языка: handler(lang) вызывается один раз на переключение. */
export function onLangChange(handler) {
  document.addEventListener("wwn:langchange", (event) => handler(event.detail.lang));
}

/** Стартовая локализация страницы. */
export function bootI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  applyI18n(lang);
  initLangSwitch();
  return lang;
}
