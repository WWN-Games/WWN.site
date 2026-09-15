/* ============================================================================
   WWN — локализация интерфейса (RU / EN)
   ----------------------------------------------------------------------------
   Правьте тексты здесь. В разметке: data-i18n="ключ", а также
   data-i18n-html / data-i18n-placeholder / data-i18n-title / data-i18n-aria.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { $$ } from "./utils.js";

export const LANG_KEY = "wwn-lang";

export const I18N = {
  ru: {
    "nav.home": "Главная",
    "nav.features": "Возможности",
    "nav.factions": "Фракции",
    "nav.gallery": "Галерея",
    "nav.news": "Новости",
    "nav.wiki": "Вики",
    "nav.download": "Скачать",
    "nav.faq": "FAQ",
    "brand.sub": "Мод для Rusted Warfare",
    "siteTagline": "Мод WWN для Rusted Warfare. Космические флоты, наземные сражения и живая лига игроков.",

    "hero.badge": "версия {version}",
    "hero.title": "Галактика на грани <span class=\"accent\">Тройственного Конфликта</span>",
    "hero.desc": "WWN — масштабный мод для Rusted Warfare: битвы в космосе и на поверхности, две великие державы, десятки миров и живая лига игроков. Разверни флот и перепиши карту галактики.",
    "hero.downloadSteam": "Скачать в Steam",
    "hero.downloadDrive": "Google Drive",
    "hero.openWiki": "Открыть вики",

    "stats.units": "юнитов и строений",
    "stats.factions": "фракции",
    "stats.maps": "карт",
    "stats.races": "расы",

    "features.title": "Возможности мода",
    "features.subtitle": "Что WWN добавляет в Rusted Warfare",
    "features.f1.title": "Битвы в космосе",
    "features.f1.desc": "Новая механика: сражения идут не на одной планете. Орбитальные флоты перерезают пути снабжения и поддерживают армию с неба.",
    "features.f2.title": "Новые юниты",
    "features.f2.desc": "Техника Фензема и Протона: от кораблей поддержки до импровизированных протонских прототипов, проверенных боем.",
    "features.f3.title": "Новые карты",
    "features.f3.desc": "Космические и смешанные карты с разными окружениями — от орбитальных коридоров до укреплённых планетарных баз.",
    "features.f4.title": "Улучшенный геймплей",
    "features.f4.desc": "Переработанные механики мода: экономика, оборона и осад. Каждая партия играется по-новому.",
    "features.f5.title": "Лор и фракции",
    "features.f5.desc": "Полноценная вселенная: история галактики, две державы, расы и карты эпох — всё это в вики.",
    "features.f6.title": "Живое сообщество",
    "features.f6.desc": "Обновления, балансные обсуждения, кастомные карты и матчи. Присоединяйся к Discord и играй с другими.",

    "facsec.kicker": "Фракции",
    "facsec.title": "Две державы — одна галактика",
    "facsec.sub": "Выбери сторону в Тройственном Конфликте",
    "facsec.fenearth.name": "Фенземская Республика",
    "facsec.fenearth.motto": "Наследница Всегалактической Федерации",
    "facsec.fenearth.desc": "Федеративная парламентская республика и вторая экономика галактики. Промышленная мощь, технологии ВГФ и тяжёлый флот.",
    "facsec.proton.name": "Движение Протон",
    "facsec.proton.motto": "PHATHOU — Первый порядок",
    "facsec.proton.desc": "Союз кланов Территории Отен. Массовая армия, неприхотливая техника и ярость крокодилоподобных васттов.",
    "facsec.openLore": "Подробнее в вики",
    "factions.chip.industry": "Промышленность",
    "factions.chip.fleet": "Тяжёлый флот",
    "factions.chip.tech": "Технологии ВГФ",
    "factions.chip.mass": "Массовая армия",
    "factions.chip.repair": "Полевой ремонт",
    "factions.chip.vasst": "Вастт",

    "gallery.title": "Галерея",
    "gallery.subtitle": "Скриншоты из игры",
    "gallery.close": "Закрыть",
    "gallery.prev": "Назад",
    "gallery.next": "Вперёд",

    "news.title": "Что нового",
    "news.subtitle": "Новости мода и сообщества",
    "news.all": "Все патчноуты",

    "download.title": "Скачать WWN",
    "download.subtitle": "Установка за пару минут",
    "download.steam.title": "Steam Workshop",
    "download.steam.desc": "Один клик — автообновления и подписка на мод прямо в мастерской Steam.",
    "download.steam.btn": "Открыть в Steam",
    "download.drive.title": "Google Drive",
    "download.drive.desc": "Ручная установка: скачай архив, распакуй в папку mods/units игры и включи мод в меню.",
    "download.drive.btn": "Скачать с Drive",
    "download.gitlab": "Актуальные релизы также публикуются на GitLab",
    "download.linkSoon": "Ссылка скоро появится",
    "download.steps.title": "Как установить",
    "download.step1.title": "Скачай мод",
    "download.step1.desc": "Подпишись на мод в Steam Workshop, скачай архив с Google Drive или последний релиз с GitLab.",
    "download.step2.title": "Установи",
    "download.step2.desc": "В Steam мод включится сам. Для архива распакуй его в директорию mods/units Rusted Warfare.",
    "download.step3.title": "Играй",
    "download.step3.desc": "Запусти Rusted Warfare, включи мод в меню модов и создай игру с картами WWN.",
    "download.requirements": "Нужна лицензионная Rusted Warfare (Steam / Google Play). Мод бесплатный.",
    "download.help": "Нужна помощь с установкой? Загляни в вики или напиши в сообщество.",

    "faq.title": "Частые вопросы",
    "faq.q1": "Что такое WWN?",
    "faq.a1": "WWN — крупный мод для Rusted Warfare: космические сражения, новые юниты и карты, две фракции и собственная вселенная с полным лором.",
    "faq.q2": "Мод бесплатный?",
    "faq.a2": "Да, мод распространяется бесплатно. Нужна только базовая игра Rusted Warfare.",
    "faq.q3": "Как играть по сети?",
    "faq.a3": "Все игроки в лобби должны иметь одинаковую версию мода. Хост создаёт игру с картами WWN, остальные подключаются как обычно.",
    "faq.q4": "Мод ломает сохранения?",
    "faq.a4": "Старые сохранения без мода могут не открываться. Перед обновлением WWN рекомендуем начать новую игру.",
    "faq.q5": "Как следить за обновлениями?",
    "faq.a5": "Подпишись на мод в Steam Workshop, следи за релизами на GitLab и заглядывай в раздел «Что нового» и патчноуты в вики.",
    "faq.q6": "Где обсуждать баланс и искать соперников?",
    "faq.a6": "В сообществе WWN: Discord и Steam Workshop. Ссылки — в шапке и в подвале сайта.",

    "footer.nav": "Навигация",
    "footer.community": "Сообщество",
    "footer.download": "Скачать",
    "footer.disclaimer": "Официальный сайт мода WWN для Rusted Warfare. Rusted Warfare © Corroding Games.",
    "footer.rights": "Все материалы мода принадлежат команде WWN.",
    "footer.backToTop": "Наверх",

    "meta.title.home": "WWN — официальный сайт мода для Rusted Warfare | Скачать, вики, лор",
    "meta.title.wiki": "Вики WWN",
    "meta.title.wikiHome": "Вики WWN — лор, фракции, юниты, механики и гайды",
    "meta.title.catalog": "Каталог WWN — фракции, юниты и строения",
    "wiki.title": "Вики WWN",
    "wiki.subtitle": "Справочник по моду: лор, фракции, расы, юниты, строения, механики и гайды.",
    "wiki.sidebar": "Разделы вики",
    "wiki.search.title": "Поиск по вики",
    "wiki.search.placeholder": "Поиск по вики…",
    "wiki.search.empty": "Ничего не найдено",
    "wiki.search.hint": "Введи минимум 2 символа",
    "wiki.articles": "статей",
    "wiki.stats.sections": "разделов",
    "wiki.stats.factions": "фракции",
    "wiki.back": "Назад в вики",
    "wiki.toc": "Содержание",
    "wiki.updated": "Обновлено",
    "wiki.draft": "Черновик",
    "wiki.readingTime": "мин чтения",
    "wiki.prev": "Предыдущая",
    "wiki.next": "Следующая",
    "wiki.notFound.title": "Статья не найдена",
    "wiki.notFound.desc": "Проверь ссылку или вернись к списку статей.",
    "wiki.loadError.desc": "Скорее всего, сайт открыт как файл. Запусти локальный сервер (например, python3 -m http.server) или открой сайт на GitHub Pages.",

    "catalog.title": "Каталог",
    "catalog.subtitle": "Фракции, юниты и строения WWN",
    "catalog.tab.factions": "Фракции",
    "catalog.tab.units": "Юниты",
    "catalog.tab.buildings": "Строения",
    "catalog.filter.all": "Все",
    "catalog.filter.faction": "Фракция",
    "catalog.filter.type": "Тип",
    "catalog.filter.tag": "Тег",
    "catalog.sort.label": "Сортировка",
    "catalog.sort.name": "По названию",
    "catalog.sort.cost": "По цене",
    "catalog.sort.hp": "По прочности",
    "catalog.sort.dps": "По урону",
    "catalog.search.placeholder": "Поиск по названию…",
    "catalog.empty": "Ничего не найдено. Измени фильтры.",
    "catalog.noData": "Данные не загрузились (нужен локальный сервер).",
    "catalog.cost": "Цена",
    "catalog.hp": "Прочность",
    "catalog.shield": "Щит",
    "catalog.dps": "Урон",
    "catalog.speed": "Скорость",
    "catalog.range": "Дальность",
    "catalog.buildTime": "Постройка",
    "catalog.seconds": " с",
    "catalog.strong": "Сильно против",
    "catalog.weak": "Слабо против",
    "catalog.draft": "Черновик",
    "catalog.faction.playstyle": "Стиль игры",
    "catalog.faction.specialty": "Специализация",
    "catalog.openLore": "Статья в вики",
    "catalog.type.ground": "Наземные",
    "catalog.type.air": "Воздух",
    "catalog.type.naval": "Флот",
    "catalog.type.space": "Космос",
    "catalog.type.structure": "Строение",
    "catalog.type.support": "Поддержка",
    "catalog.type.economy": "Экономика",
    "catalog.type.defense": "Оборона",
    "catalog.count": "Найдено: {n}",

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
    "brand.sub": "A Rusted Warfare mod",
    "siteTagline": "The WWN mod for Rusted Warfare. Space fleets, ground battles and a living players' league.",

    "hero.badge": "version {version}",
    "hero.title": "A galaxy on the edge of <span class=\"accent\">the Triple Conflict</span>",
    "hero.desc": "WWN is a large-scale Rusted Warfare mod: battles in space and on the surface, two great powers, dozens of worlds and a living players' league. Deploy your fleet and rewrite the galactic map.",
    "hero.downloadSteam": "Get it on Steam",
    "hero.downloadDrive": "Google Drive",
    "hero.openWiki": "Open the wiki",

    "stats.units": "units & structures",
    "stats.factions": "factions",
    "stats.maps": "maps",
    "stats.races": "races",

    "features.title": "Mod features",
    "features.subtitle": "What WWN adds to Rusted Warfare",
    "features.f1.title": "Space battles",
    "features.f1.desc": "A new mechanic: fights are no longer limited to one planet. Orbital fleets cut supply lines and support the army from above.",
    "features.f2.title": "New units",
    "features.f2.desc": "Fenearth and Proton hardware: from support ships to improvised Proton prototypes proven in battle.",
    "features.f3.title": "New maps",
    "features.f3.desc": "Space and mixed maps with varied environments — from orbital corridors to fortified planetary bases.",
    "features.f4.title": "Improved gameplay",
    "features.f4.desc": "Reworked mod mechanics: economy, defense and sieges. Every match plays out differently.",
    "features.f5.title": "Lore & factions",
    "features.f5.desc": "A full universe: galaxy history, two powers, races and era maps — all in the wiki.",
    "features.f6.title": "A living community",
    "features.f6.desc": "Updates, balance talks, custom maps and matches. Join the Discord and play with others.",

    "facsec.kicker": "Factions",
    "facsec.title": "Two powers, one galaxy",
    "facsec.sub": "Pick a side in the Triple Conflict",
    "facsec.fenearth.name": "Fenearth Republic",
    "facsec.fenearth.motto": "Heir of the Galactic Federation",
    "facsec.fenearth.desc": "A federal parliamentary republic and the galaxy's second economy. Industrial might, GF technology and a heavy fleet.",
    "facsec.proton.name": "Proton Movement",
    "facsec.proton.motto": "PHATHOU — the First Order",
    "facsec.proton.desc": "A union of clans of the Oten Territory. A mass army, rugged hardware and the ferocity of the crocodile-like Vasst.",
    "facsec.openLore": "Read in the wiki",
    "factions.chip.industry": "Industry",
    "factions.chip.fleet": "Heavy fleet",
    "factions.chip.tech": "GF technology",
    "factions.chip.mass": "Mass army",
    "factions.chip.repair": "Field repairs",
    "factions.chip.vasst": "Vasst",

    "gallery.title": "Gallery",
    "gallery.subtitle": "In-game screenshots",
    "gallery.close": "Close",
    "gallery.prev": "Previous",
    "gallery.next": "Next",

    "news.title": "What's new",
    "news.subtitle": "Mod and community news",
    "news.all": "All patch notes",

    "download.title": "Download WWN",
    "download.subtitle": "Install in a couple of minutes",
    "download.steam.title": "Steam Workshop",
    "download.steam.desc": "One click — auto-updates and a workshop subscription right inside Steam.",
    "download.steam.btn": "Open in Steam",
    "download.drive.title": "Google Drive",
    "download.drive.desc": "Manual install: download the archive, unpack it into the game's mods/units folder and enable the mod in the menu.",
    "download.drive.btn": "Download from Drive",
    "download.gitlab": "Latest releases are also published on GitLab",
    "download.linkSoon": "Link coming soon",
    "download.steps.title": "How to install",
    "download.step1.title": "Download the mod",
    "download.step1.desc": "Subscribe on Steam Workshop, download the archive from Google Drive, or grab the latest GitLab release.",
    "download.step2.title": "Install",
    "download.step2.desc": "Steam enables it automatically. For the archive, unpack it into the Rusted Warfare mods/units directory.",
    "download.step3.title": "Play",
    "download.step3.desc": "Launch Rusted Warfare, enable the mod in the mods menu and host a game on WWN maps.",
    "download.requirements": "Requires a legit copy of Rusted Warfare (Steam / Google Play). The mod is free.",
    "download.help": "Need install help? Check the wiki or ping the community.",

    "faq.title": "FAQ",
    "faq.q1": "What is WWN?",
    "faq.a1": "WWN is a major Rusted Warfare mod: space combat, new units and maps, two factions and its own fully-fleshed universe.",
    "faq.q2": "Is the mod free?",
    "faq.a2": "Yes, the mod is free. You only need the base Rusted Warfare game.",
    "faq.q3": "How do I play online?",
    "faq.a3": "All players in a lobby must run the same mod version. The host creates a game on WWN maps, others join as usual.",
    "faq.q4": "Will the mod break my saves?",
    "faq.a4": "Old vanilla saves may not open. Before updating WWN we recommend starting a new game.",
    "faq.q5": "How do I track updates?",
    "faq.a5": "Subscribe on Steam Workshop, follow GitLab releases and check the \"What's new\" section and wiki patch notes.",
    "faq.q6": "Where to discuss balance and find opponents?",
    "faq.a6": "In the WWN community: Discord and Steam Workshop. Links are in the header and footer.",

    "footer.nav": "Navigation",
    "footer.community": "Community",
    "footer.download": "Download",
    "footer.disclaimer": "Official website of the WWN mod for Rusted Warfare. Rusted Warfare © Corroding Games.",
    "footer.rights": "All mod materials belong to the WWN team.",
    "footer.backToTop": "Back to top",

    "meta.title.home": "WWN — official mod site for Rusted Warfare | Download, wiki, lore",
    "meta.title.wiki": "WWN Wiki",
    "meta.title.wikiHome": "WWN Wiki — lore, factions, units, mechanics and guides",
    "meta.title.catalog": "WWN Catalog — factions, units and structures",
    "wiki.title": "WWN Wiki",
    "wiki.subtitle": "Mod reference: lore, factions, races, units, structures, mechanics and guides.",
    "wiki.sidebar": "Wiki sections",
    "wiki.search.title": "Search the wiki",
    "wiki.search.placeholder": "Search the wiki…",
    "wiki.search.empty": "Nothing found",
    "wiki.search.hint": "Type at least 2 characters",
    "wiki.articles": "articles",
    "wiki.stats.sections": "sections",
    "wiki.stats.factions": "factions",
    "wiki.back": "Back to wiki",
    "wiki.toc": "Contents",
    "wiki.updated": "Updated",
    "wiki.draft": "Draft",
    "wiki.readingTime": "min read",
    "wiki.prev": "Previous",
    "wiki.next": "Next",
    "wiki.notFound.title": "Article not found",
    "wiki.notFound.desc": "Check the link or go back to the article list.",
    "wiki.loadError.desc": "Most likely the site is opened as a file. Run a local server (e.g. python3 -m http.server) or open the site on GitHub Pages.",

    "catalog.title": "Catalog",
    "catalog.subtitle": "WWN factions, units and structures",
    "catalog.tab.factions": "Factions",
    "catalog.tab.units": "Units",
    "catalog.tab.buildings": "Structures",
    "catalog.filter.all": "All",
    "catalog.filter.faction": "Faction",
    "catalog.filter.type": "Type",
    "catalog.filter.tag": "Tag",
    "catalog.sort.label": "Sort by",
    "catalog.sort.name": "By name",
    "catalog.sort.cost": "By cost",
    "catalog.sort.hp": "By health",
    "catalog.sort.dps": "By damage",
    "catalog.search.placeholder": "Search by name…",
    "catalog.empty": "Nothing found. Try different filters.",
    "catalog.noData": "Data failed to load (a local server is required).",
    "catalog.cost": "Cost",
    "catalog.hp": "Health",
    "catalog.shield": "Shield",
    "catalog.dps": "Damage",
    "catalog.speed": "Speed",
    "catalog.range": "Range",
    "catalog.buildTime": "Build time",
    "catalog.seconds": "s",
    "catalog.strong": "Strong vs",
    "catalog.weak": "Weak vs",
    "catalog.draft": "Draft",
    "catalog.faction.playstyle": "Playstyle",
    "catalog.faction.specialty": "Specialty",
    "catalog.openLore": "Wiki article",
    "catalog.type.ground": "Ground",
    "catalog.type.air": "Air",
    "catalog.type.naval": "Naval",
    "catalog.type.space": "Space",
    "catalog.type.structure": "Structure",
    "catalog.type.support": "Support",
    "catalog.type.economy": "Economy",
    "catalog.type.defense": "Defense",
    "catalog.count": "Found: {n}",

    "notfound.title": "404 — lost in space",
    "notfound.desc": "This page doesn't exist. It probably drifted to a far orbit.",
    "notfound.home": "Go home",
    "notfound.wiki": "Open the wiki"
  }
};

/* ------------------------------------------------------------------ язык -- */
export function getLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && I18N[stored]) return stored;
  } catch (e) {}
  const nav = (navigator.language || "ru").slice(0, 2).toLowerCase();
  return nav === "ru" ? "ru" : "en";
}

export function setLang(lang) {
  if (!I18N[lang] || document.documentElement.lang === lang) return;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  document.documentElement.lang = lang;
  applyI18n(lang);
  document.dispatchEvent(new CustomEvent("wwn:langchange", { detail: { lang } }));
}

/* -------------------------------------------------------------- переводы -- */
export function t(key, lang, vars) {
  const dict = I18N[lang || getLang()] || I18N.ru;
  let value = dict[key];
  if (value === undefined) value = I18N.ru[key];
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
