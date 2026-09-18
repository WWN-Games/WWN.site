/* ============================================================================
   WWN — оболочка вики (ES-модуль): шапка, сайдбар, главная вики и поиск.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, getLang, onLangChange, t } from "./i18n.js";
import { $, abs, collator, debounce, emptyBlock, escapeHtml, foldSearch, formatDate, loc, nextFocusIndex, plural } from "./utils.js";
import { initReveal } from "./ui.js";
import { stripMd } from "./md-text.js";


const ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12M4 7l8 5 8-5M12 2 4 7v10l8 5 8-5V7z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.63.24 1.05.85 1.03 1.56V11a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1.03z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.5 6.4-6.4 2.5 2.5-6.4z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
};

let navData = null;
let flatArticles = [];
let liveStats = null;
/* Прямая ссылка на раздел (крошки статьи ведут на ./#wiki-cat-<id>) —
   скроллим сами, но только один раз: при смене языка хаб перерисовывается,
   и повторный прыжок к разделу был бы лишним. */
let hashScrolled = false;

/* Префикс к корню вики: на статье «../../», на хабе — пусто. */
let pagePrefix = "";

/* Свёрнутость разделов в сайдбаре (запоминается на десктопе). */
const NAV_STATE_KEY = "wwn-wiki-nav";
let navState = {};
try { navState = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || "{}"); } catch {}

export const getFlatArticles = () => flatArticles;
function indexNav() {
  flatArticles = [
    ...navData.categories.flatMap((cat) =>
      cat.articles.map((article) => ({ ...article, category: cat }))
    ),
    // черновики открываются по прямой ссылке, но в интерфейсе их нет
    ...(navData.drafts || [])
  ];
}

/** Форма слова «статья» по числу: «1 статья», «2 статьи», «5 статей». */
const articleWord = (n, lang) =>
  plural(lang, n, {
    one: t("wiki.articles.one", lang),
    few: t("wiki.articles.few", lang),
    many: t("wiki.articles.many", lang),
    other: t("wiki.articles.other", lang)
  });
const articleCount = (n, lang) => `${n} ${articleWord(n, lang)}`;

async function loadNav() {
  try {
    const cached = sessionStorage.getItem("wwn-nav-cache-v2");
    if (cached) {
      navData = JSON.parse(cached);
      indexNav();
    }
  } catch {}

  try {
    const res = await fetch(abs(`data/wiki-nav.json?v=${WWN_CONFIG.version}`));
    if (!res.ok) throw new Error("nav");
    navData = await res.json();
    try { sessionStorage.setItem("wwn-nav-cache-v2", JSON.stringify(navData)); } catch {}
    indexNav();
    return navData;
  } catch (e) {
    // сеть/файл недоступны — если есть валидный кэш, работаем на нём
    if (navData) return navData;
    throw e;
  }
}

/* На мобильных список разделов свёрнут, чтобы не выталкивать контент. */
let sidebarCollapsed = null;
const mobileSidebar = () => window.matchMedia("(max-width: 1040px)").matches;

function initSidebarToggle(lang) {
  const nav = $("#wikiNav");
  const btn = $("#wikiNavToggle");
  if (!nav || !btn) return;
  if (!btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      sidebarCollapsed = !nav.classList.contains("is-collapsed");
      applySidebarState(btn, nav);
    });
  }
  btn.textContent = t("wiki.sidebar", lang);
  applySidebarState(btn, nav);
}

function applySidebarState(btn, nav) {
  const mobile = mobileSidebar();
  const collapsed = mobile && (sidebarCollapsed ?? true);
  nav.classList.toggle("is-collapsed", collapsed);
  btn.hidden = !mobile;
  btn.setAttribute("aria-expanded", String(!collapsed));
}

function buildSidebar(lang, activeSlug) {
  const nav = $("#wikiNav");
  if (!nav || !navData) return;
  const mobile = mobileSidebar();
  nav.replaceChildren(
    ...navData.categories.map((cat) => {
      const group = document.createElement("details");
      group.className = "wiki-nav__group";
      const hasActive = cat.articles.some((article) => article.slug === activeSlug);
      group.open = mobile ? hasActive : navState[cat.id] !== false;
      group.addEventListener("toggle", () => {
        if (mobileSidebar()) return;
        navState[cat.id] = group.open;
        try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify(navState)); } catch {}
      });

      const summary = document.createElement("summary");
      summary.className = "wiki-nav__summary";
      const icon = document.createElement("span");
      icon.className = "wiki-nav__icon";
      icon.innerHTML = ICONS[cat.icon] || ICONS.book;
      const label = document.createElement("span");
      label.className = "wiki-nav__label";
      label.textContent = loc(cat.title, lang);
      const count = document.createElement("span");
      count.className = "wiki-nav__count";
      count.textContent = String(cat.articles.length);
      summary.append(icon, label, count);

      const list = document.createElement("ul");
      cat.articles.forEach((article) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${pagePrefix}${article.slug}/`;
        link.textContent = loc(article.title, lang);
        if (article.slug === activeSlug) {
          link.className = "is-active";
          link.setAttribute("aria-current", "page");
        }
        li.append(link);
        list.append(li);
      });
      group.append(summary, list);
      return group;
    })
  );
  // активная статья может оказаться ниже прокрутки сайдбара
  nav.querySelector("a.is-active")?.scrollIntoView({ block: "nearest" });
}
export function buildHome(lang) {
  const grid = $("#wikiCategories");
  if (!grid || !navData) return;

  const stats = $("#wikiHeroStats");
  if (stats) {
    const published = flatArticles.filter((article) => !article.draft);
    const rows = [
      [navData.categories.length, t("wiki.stats.sections", lang)],
      [published.length, articleWord(published.length, lang)]
    ];
    // число фракций приходит из данных позже — не показываем «0», просто ждём
    if (liveStats) rows.push([liveStats.factions, t("wiki.stats.factions", lang)]);
    stats.replaceChildren(
      ...rows.map(([value, label]) => {
        const span = document.createElement("span");
        const strong = document.createElement("b");
        strong.textContent = String(value);
        span.append(strong, document.createTextNode(label));
        return span;
      })
    );
  }

  const quick = $("#wikiQuickLinks");
  if (quick) {
    // быстрые ссылки — статьи раздела «Начало» (данные, а не хардкод)
    const start = navData.categories.find((cat) => cat.id === "start");
    quick.replaceChildren(
      ...(start?.articles || []).slice(0, 3).map((article) => {
        const link = document.createElement("a");
        link.className = "wiki-hero__chip";
        link.href = `${pagePrefix}${article.slug}/`;
        link.textContent = loc(article.title, lang);
        return link;
      })
    );
  }

  const recent = $("#wikiRecent");
  if (recent) {
    const all = navData.categories.flatMap((cat) => cat.articles.map((article) => ({ ...article, category: cat })));
    const latest = all
      .filter((article) => article.updated)
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 4);
    if (latest.length) {
      const title = document.createElement("h2");
      title.textContent = t("wiki.recent", lang);
      const row = document.createElement("div");
      row.className = "wiki-recent__row";
      for (const article of latest) {
        const link = document.createElement("a");
        link.className = "wiki-recent__card";
        link.href = `${pagePrefix}${article.slug}/`;
        const strong = document.createElement("b");
        strong.textContent = loc(article.title, lang);
        const small = document.createElement("span");
        small.textContent = `${loc(article.category.title, lang)} · ${formatDate(article.updated, lang)}`;
        link.append(strong, small);
        row.append(link);
      }
      recent.replaceChildren(title, row);
      recent.hidden = false;
    } else {
      recent.replaceChildren();
      recent.hidden = true;
    }
  }

  grid.replaceChildren(
    ...navData.categories.map((cat) => {
      const card = document.createElement("section");
      card.className = "wiki-cat";
      card.dataset.reveal = "";
      card.id = `wiki-cat-${cat.id}`;

      const head = document.createElement("header");
      head.className = "wiki-cat__head";

      const icon = document.createElement("div");
      icon.className = "wiki-cat__icon";
      icon.innerHTML = ICONS[cat.icon] || ICONS.book;

      const text = document.createElement("div");
      text.className = "wiki-cat__text";
      const title = document.createElement("h3");
      title.textContent = loc(cat.title, lang);
      const desc = document.createElement("p");
      desc.className = "wiki-cat__desc";
      desc.textContent = loc(cat.desc, lang);
      text.append(title, desc);

      const count = document.createElement("span");
      count.className = "wiki-cat__count";
      count.textContent = articleCount(cat.articles.length, lang);

      head.append(icon, text, count);
      card.setAttribute("aria-labelledby", `wiki-cat-${cat.id}-title`);
      title.id = `wiki-cat-${cat.id}-title`;

      const list = document.createElement("ul");
      cat.articles.forEach((article) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${pagePrefix}${article.slug}/`;
        link.textContent = loc(article.title, lang);
        li.append(link);
        list.append(li);
      });

      card.append(head, list);
      return card;
    })
  );
  initReveal(grid);

  // секции рисуются после загрузки страницы — браузер до них не доскролливает сам
  if (!hashScrolled) {
    hashScrolled = true;
    const id = location.hash.match(/^#(wiki-cat-[\w-]+)$/)?.[1];
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }
}
const highlight = (text, query) => {
  const fold = foldSearch(text);
  const needle = foldSearch(query);
  if (!needle) return escapeHtml(text);
  const parts = [];
  let pos = 0;
  let index = fold.indexOf(needle);
  while (index !== -1) {
    parts.push(escapeHtml(text.slice(pos, index)), "<mark>", escapeHtml(text.slice(index, index + needle.length)), "</mark>");
    pos = index + needle.length;
    index = fold.indexOf(needle, pos);
  }
  parts.push(escapeHtml(text.slice(pos)));
  return parts.join("");
};

function snippet(text, fold, query) {
  const index = fold.indexOf(query);
  if (index === -1) return `${text.slice(0, 130)}…`;
  const from = Math.max(0, index - 55);
  const to = Math.min(text.length, index + 90);
  return `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
}

let searchIndex = null;
let searchIndexLang = null;
let searchLoading = null;
let searchLoadingLang = null;
let searchSeq = 0;

function resetSearchIndex() {
  searchIndex = null;
  searchIndexLang = null;
}

/** Готовый поисковый индекс (data/search-index-<lang>.json): один запрос
 *  вместо загрузки всех markdown-файлов. Если файла нет — загрузка статей. */
async function fetchSearchIndex(lang) {
  const res = await fetch(abs(`data/search-index-${lang}.json?v=${WWN_CONFIG.version}`));
  if (!res.ok) throw new Error("no index");
  const entries = await res.json();
  const bySlug = new Map(flatArticles.map((article) => [article.slug, article]));
  return entries
    .map((entry) => {
      const article = bySlug.get(entry.slug);
      if (!article) return null;
      const text = entry.text || "";
      return { ...article, text, fold: foldSearch(text) };
    })
    .filter(Boolean);
}

async function buildSearchIndexFromMarkdown(lang) {
  return Promise.all(
    flatArticles
      .filter((article) => !article.draft)
      .map(async (article) => {
      try {
        const res = await fetch(abs(`content/${lang}/${article.slug}.md?v=${WWN_CONFIG.version}`));
        const raw = res.ok ? await res.text() : "";
        const text = stripMd(raw);
        return { ...article, text, fold: foldSearch(text) };
      } catch {
        return { ...article, text: "", fold: "" };
      }
    })
  );
}

async function buildSearchIndex(lang) {
  if (searchIndex && searchIndexLang === lang) return searchIndex;
  if (searchLoading && searchLoadingLang === lang) return searchLoading;
  searchLoadingLang = lang;

  searchLoading = (async () => {
    let items;
    try {
      items = await fetchSearchIndex(lang);
    } catch {
      items = await buildSearchIndexFromMarkdown(lang);
    }
    if (searchLoadingLang === lang) {
      searchIndex = items;
      searchIndexLang = lang;
      searchLoading = null;
    }
    return items;
  })();

  return searchLoading;
}

/* Состояние панели поиска: фильтр по разделу, «показать все», недавние запросы. */
let searchSection = "";
let searchExpanded = false;
let searchItems = [];
let searchQuery = "";
const RECENT_KEY = "wwn-wiki-search";
let recentQueries = [];
try { recentQueries = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5); } catch {}

/** Совпадение в заголовке важнее описания, описание — важнее текста статьи. */
function scoreOf(item, needle, lang) {
  const title = foldSearch(loc(item.title, lang));
  const desc = foldSearch(loc(item.desc, lang));
  const category = foldSearch(loc(item.category.title, lang));
  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (title.includes(needle)) return 2;
  if (category.includes(needle)) return 3;
  if (desc.includes(needle)) return 4;
  const at = item.fold.indexOf(needle);
  return at === -1 ? null : 5 + Math.min(9, Math.floor(at / 400));
}

/** Чипы-фильтры по разделам с числом совпадений. */
function renderFilters(lang) {
  const box = $("#searchFilters");
  if (!box) return;
  const counts = new Map();
  for (const found of searchItems) {
    const id = found.item.category.id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const chip = (label, active, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `search-chip${active ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  };
  box.replaceChildren(
    chip(t("wiki.search.all", lang), !searchSection, () => {
      searchSection = "";
      renderFound(lang);
    }),
    ...(navData?.categories || [])
      .filter((cat) => counts.has(cat.id))
      .map((cat) =>
        chip(`${loc(cat.title, lang)} · ${counts.get(cat.id)}`, searchSection === cat.id, () => {
          searchSection = searchSection === cat.id ? "" : cat.id;
          renderFound(lang);
        })
      )
  );
}

/** Результаты поиска с учётом фильтра и «показать все». */
function renderFound(lang) {
  const results = $("#searchResults");
  const hint = $("#searchHint");
  if (!results) return;
  const found = searchSection ? searchItems.filter((f) => f.item.category.id === searchSection) : searchItems;

  if (hint) {
    hint.style.display = "";
    hint.textContent = t("wiki.search.found", lang, { n: found.length });
  }
  renderFilters(lang);

  if (!found.length) {
    const sections = document.createElement("div");
    sections.className = "search-sections";
    for (const cat of navData?.categories || []) {
      const link = document.createElement("a");
      link.href = `${pagePrefix}#wiki-cat-${cat.id}`;
      link.textContent = loc(cat.title, lang);
      sections.append(link);
    }
    results.replaceChildren(emptyBlock(t("wiki.search.empty", lang)), sections);
    return;
  }

  const limit = searchExpanded ? found.length : 12;
  const nodes = found.slice(0, limit).map(({ item, title, category }) => {
    const link = document.createElement("a");
    link.className = "search-result";
    link.href = `${pagePrefix}${item.slug}/`;
    const top = document.createElement("span");
    top.className = "search-result__top";
    const tag = document.createElement("span");
    tag.className = "search-result__cat";
    tag.textContent = category;
    const strong = document.createElement("b");
    strong.innerHTML = highlight(title, searchQuery);
    top.append(tag, strong);
    const text = document.createElement("p");
    text.innerHTML = highlight(snippet(item.text, item.fold, foldSearch(searchQuery)), searchQuery);
    link.append(top, text);
    return link;
  });

  if (found.length > limit) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "search-more";
    more.textContent = t("wiki.search.more", lang, { n: found.length - limit });
    more.addEventListener("click", () => {
      searchExpanded = true;
      renderFound(lang);
    });
    nodes.push(more);
  }

  results.replaceChildren(...nodes);
}

/** Недавние запросы — когда поле поиска пустое. */
function renderRecent(lang) {
  const results = $("#searchResults");
  if (!results) return;
  if (!recentQueries.length) {
    results.replaceChildren();
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "search-recent";
  const title = document.createElement("p");
  title.className = "search-recent__title";
  title.textContent = t("wiki.search.recent", lang);
  const row = document.createElement("div");
  row.className = "search-recent__row";
  for (const query of recentQueries) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "search-chip";
    chip.textContent = query;
    chip.addEventListener("click", () => {
      const panelInput = $("#searchPanelInput");
      if (!panelInput) return;
      panelInput.value = query;
      panelInput.focus();
      runSearch(query, lang);
    });
    row.append(chip);
  }
  wrap.append(title, row);
  results.replaceChildren(wrap);
}

function rememberQuery(query) {
  const value = query.trim();
  if (value.length < 2) return;
  recentQueries = [value, ...recentQueries.filter((q) => q !== value)].slice(0, 5);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentQueries)); } catch {}
}

async function runSearch(query, lang) {
  const results = $("#searchResults");
  const hint = $("#searchHint");
  const filters = $("#searchFilters");
  if (!results) return;
  const seq = ++searchSeq;
  searchQuery = query.trim();

  const needle = foldSearch(searchQuery);
  if (needle.length < 2) {
    searchItems = [];
    filters?.replaceChildren();
    if (hint) {
      hint.style.display = "";
      hint.textContent = t("wiki.search.hint", lang);
    }
    renderRecent(lang);
    return;
  }

  const items = await buildSearchIndex(lang);
  if (seq !== searchSeq) return;

  searchItems = items
    .map((item) => {
      const score = scoreOf(item, needle, lang);
      return score === null
        ? null
        : { item, title: loc(item.title, lang), category: loc(item.category.title, lang), score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || collator(lang).compare(a.title, b.title));

  if (seq !== searchSeq) return;
  searchExpanded = false;
  renderFound(lang);
}

function initSearch() {
  const panel = $("#searchPanel");
  const input = $("#searchPanelInput");
  const results = $("#searchResults");
  const sideInput = $("#searchInput");
  if (!panel || !input) return () => {};

  let searchLang = getLang();

  const openPanel = (seed = "") => {
    if (!panel.open) panel.showModal();
    if (seed || input.value) input.value = seed;
    searchSection = "";
    searchExpanded = false;
    input.focus();
    input.select();
    runSearch(input.value, searchLang);
  };

  sideInput?.addEventListener("click", () => openPanel(sideInput.value));
  sideInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openPanel(sideInput.value);
    }
  });

  input.addEventListener("input", debounce(() => runSearch(input.value, searchLang), 160));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      rememberQuery(input.value);
      runSearch(input.value, searchLang);
      return;
    }
    if (event.key !== "ArrowDown") return;
    const first = results?.querySelector(".search-result");
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  results?.addEventListener("keydown", (event) => {
    const items = [...results.querySelectorAll(".search-result")];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    if (index === -1) return;
    if (event.key === "ArrowUp" && index === 0) {
      event.preventDefault();
      input.focus();
      return;
    }
    const next = nextFocusIndex(items, event, { wrap: false });
    if (next === -1) return;
    event.preventDefault();
    items[next].focus();
  });

  panel.addEventListener("click", (event) => {
    if (event.target === panel) panel.close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || panel.open) return;
    const isK = event.code === "KeyK" || (event.key || "").toLowerCase() === "k";
    if ((event.ctrlKey || event.metaKey) && isK) {
      event.preventDefault();
      openPanel();
    }
  });

  return (lang) => {
    searchLang = lang;
    if (panel.open) runSearch(input.value, lang);
  };
}
function applyLangVisuals(lang) {
  const suffix = lang === "en" ? "en" : "ru";
  document.documentElement.style.setProperty(
    "--wiki-hero-img",
    `image-set(url("${abs(`assets/img/lore/tc-${suffix}-960.avif`)}") 1x, url("${abs(`assets/img/lore/tc-${suffix}.avif`)}") 2x)`
  );
}

function showNavError(lang) {
  const message = t("wiki.loadError.desc", lang);
  const nav = $("#wikiNav");
  if (nav) nav.replaceChildren(emptyBlock(message, "wiki-nav__error"));
  const home = $("#wikiCategories");
  if (home) home.replaceChildren(emptyBlock(message));
}

/** Общий запуск страниц вики/каталога: шапка, сайдбар, поиск, подписка на язык.
 *  onRender(lang) вызывается на старте и при каждой смене языка. */
export async function initShell({ slug = null, onRender } = {}) {
  // ссылки вики относительны: на статье «../../», на хабе — от текущей папки
  pagePrefix = slug ? "../".repeat(slug.split("/").length) : "";
  const setSearchLang = initSearch();
  let navReady = false;
  let navFailed = false;
  let renderQueue = Promise.resolve();

  const rerender = () => {
    const lang = getLang();
    applyLangVisuals(lang);
    setSearchLang(lang);
    if (navReady) {
      buildSidebar(lang, slug);
      initSidebarToggle(lang);
    } else if (navFailed) {
      showNavError(lang);
    }
    return onRender?.(lang);
  };

  onLangChange(() => {
    resetSearchIndex();
    renderQueue = renderQueue.then(rerender).catch(() => {});
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nav = $("#wikiNav");
      const btn = $("#wikiNavToggle");
      if (nav && btn) applySidebarState(btn, nav);
    }, 150);
  });

  const lang = await bootI18n();

  // Числа hero вики-хаба грузим отдельно и НЕ держим на них первый рендер;
  // страницам статей статистика не нужна вовсе (там нет #wikiHeroStats).
  if ($("#wikiHeroStats")) {
    import("./stats-data.js")
      .then(({ loadStats }) => loadStats())
      .then((stats) => {
        liveStats = stats;
        renderQueue = renderQueue.then(rerender).catch(() => {});
      })
      .catch(() => {});
  }

  try {
    await loadNav();
    navReady = true;
  } catch {
    navFailed = true;
    showNavError(getLang());
  }

  renderQueue = renderQueue.then(rerender).catch(() => {});
  await renderQueue;
  return getLang() || lang;
}
