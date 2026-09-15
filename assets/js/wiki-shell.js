/* ============================================================================
   WWN — оболочка вики (ES-модуль): шапка, сайдбар, главная вики и поиск.
   Не тянет marked/DOMPurify — их подключает только страница статьи (wiki.js),
   поэтому каталог использует эту оболочку без лишнего кода.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, onLangChange, registerI18n, t } from "./i18n.js";
import { WIKI_I18N } from "./i18n/wiki.js";
import { $, abs, debounce, emptyBlock, escapeHtml, loc } from "./utils.js";
import { initHeader, initReveal } from "./ui.js";

registerI18n(WIKI_I18N);

const ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12M4 7l8 5 8-5M12 2 4 7v10l8 5 8-5V7z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.63.24 1.05.85 1.03 1.56V11a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1.03z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.5 6.4-6.4 2.5 2.5-6.4z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
};

let navData = null;
let flatArticles = [];

export const getFlatArticles = () => flatArticles;

/* ------------------------------------------------------------------- nav -- */
function indexNav() {
  flatArticles = [];
  navData.categories.forEach((cat) => {
    cat.articles.forEach((article) => flatArticles.push({ ...article, category: cat }));
  });
}

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
  if (!nav) return;
  let btn = $("#wikiNavToggle");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "wikiNavToggle";
    btn.className = "wiki-nav__toggle";
    btn.setAttribute("aria-controls", "wikiNav");
    nav.before(btn);
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
      group.open = !mobile || hasActive;

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
        link.href = `article.html?p=${encodeURIComponent(article.slug)}`;
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
}

/* -------------------------------------------------------------- wiki home -- */
export function buildHome(lang) {
  const grid = $("#wikiCategories");
  if (!grid || !navData) return;

  const stats = $("#wikiHeroStats");
  if (stats) {
    stats.replaceChildren(
      ...[[navData.categories.length, t("wiki.stats.sections", lang)],
        [flatArticles.length, t("wiki.articles", lang)],
        [WWN_CONFIG.stats?.factions ?? 0, t("wiki.stats.factions", lang)]].map(([value, label]) => {
        const span = document.createElement("span");
        const strong = document.createElement("b");
        strong.textContent = String(value);
        span.append(strong, document.createTextNode(label));
        return span;
      })
    );
  }

  grid.replaceChildren(
    ...navData.categories.map((cat, i) => {
      const card = document.createElement("section");
      card.className = "wiki-cat";
      card.dataset.reveal = "";
      card.style.transitionDelay = `${i * 60}ms`;
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
      count.textContent = `${cat.articles.length} ${t("wiki.articles", lang)}`;

      head.append(icon, text, count);
      card.setAttribute("aria-labelledby", `wiki-cat-${cat.id}-title`);
      title.id = `wiki-cat-${cat.id}-title`;

      const list = document.createElement("ul");
      cat.articles.forEach((article) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `article.html?p=${encodeURIComponent(article.slug)}`;
        link.textContent = loc(article.title, lang);
        li.append(link);
        list.append(li);
      });

      card.append(head, list);
      return card;
    })
  );
  initReveal(grid);
}

/* ------------------------------------------------------- front matter/поиск -- */
export function parseFrontMatter(raw) {
  const meta = {};
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { meta, body: raw };
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value === "true" ? true : value === "false" ? false : value;
  });
  return { meta, body: raw.slice(match[0].length) };
}

const stripMd = (markdown) =>
  parseFrontMatter(markdown).body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const highlight = (text, query) =>
  escapeHtml(text).replace(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
    "<mark>$1</mark>"
  );

function snippet(text, query) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
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
      return article ? { ...article, text: entry.text || "" } : null;
    })
    .filter(Boolean);
}

async function buildSearchIndexFromMarkdown(lang) {
  return Promise.all(
    flatArticles.map(async (article) => {
      try {
        const res = await fetch(abs(`content/${lang}/${article.slug}.md`));
        const raw = res.ok ? await res.text() : "";
        return { ...article, text: stripMd(raw) };
      } catch {
        return { ...article, text: "" };
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

async function runSearch(query, lang) {
  const results = $("#searchResults");
  const hint = $("#searchHint");
  if (!results) return;
  const seq = ++searchSeq;

  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    results.replaceChildren();
    if (hint) {
      hint.style.display = "";
      hint.textContent = t("wiki.search.hint", lang);
    }
    return;
  }

  const items = await buildSearchIndex(lang);
  if (seq !== searchSeq) return;

  const found = items
    .map((item) => {
      const title = loc(item.title, lang);
      const category = loc(item.category.title, lang);
      const inTitle = title.toLowerCase().includes(needle) || category.toLowerCase().includes(needle);
      const inText = item.text.toLowerCase().includes(needle);
      return inTitle || inText ? { item, title, category, inTitle } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || a.title.localeCompare(b.title));

  if (seq !== searchSeq) return;

  if (hint) {
    hint.style.display = "";
    hint.textContent = t("wiki.search.found", lang, { n: found.length });
  }

  if (!found.length) {
    results.replaceChildren(emptyBlock(t("wiki.search.empty", lang)));
    return;
  }

  results.replaceChildren(
    ...found.slice(0, 12).map(({ item, title, category }) => {
      const link = document.createElement("a");
      link.className = "search-result";
      link.href = `article.html?p=${encodeURIComponent(item.slug)}`;
      const top = document.createElement("span");
      top.className = "search-result__top";
      const tag = document.createElement("span");
      tag.className = "search-result__cat";
      tag.textContent = category;
      const strong = document.createElement("b");
      strong.innerHTML = highlight(title, query.trim());
      top.append(tag, strong);
      const text = document.createElement("p");
      text.innerHTML = highlight(snippet(item.text, needle), query.trim());
      link.append(top, text);
      return link;
    })
  );
}

function initSearch() {
  const panel = $("#searchPanel");
  const input = $("#searchPanelInput");
  const results = $("#searchResults");
  const sideInput = $("#searchInput");
  if (!panel || !input) return () => {};

  let searchLang = document.documentElement.lang;

  const openPanel = (seed = "") => {
    if (!panel.open) panel.showModal();
    if (seed || input.value) input.value = seed;
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
    if (event.key !== "ArrowDown") return;
    const first = results?.querySelector(".search-result");
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  results?.addEventListener("keydown", (event) => {
    const items = [...results.querySelectorAll(".search-result")];
    const index = items.indexOf(document.activeElement);
    if (index === -1) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(index + 1, items.length - 1)].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) input.focus();
      else items[index - 1].focus();
    }
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

  return (lang) => { searchLang = lang; };
}

/* ------------------------------------------------------------ lang / boot -- */
function applyLangVisuals(lang) {
  document.body.style.setProperty("--wiki-hero-img", `url("${abs(`assets/img/lore/tc-${lang === "en" ? "en" : "ru"}.webp`)}")`);
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
  let lang = bootI18n();
  let navReady = false;
  let navFailed = false;
  let renderQueue = Promise.resolve();
  initHeader();
  const setSearchLang = initSearch();

  const rerender = () => {
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

  onLangChange((nextLang) => {
    lang = nextLang;
    resetSearchIndex();
    renderQueue = renderQueue.then(rerender).catch(() => {});
  });

  // смена раскладки: сайдбар-аккордеон сворачивается/разворачивается
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nav = $("#wikiNav");
      const btn = $("#wikiNavToggle");
      if (nav && btn) applySidebarState(btn, nav);
    }, 150);
  });

  try {
    await loadNav();
    navReady = true;
  } catch {
    navFailed = true;
    showNavError(lang);
  }

  renderQueue = renderQueue.then(rerender).catch(() => {});
  await renderQueue;
  return lang;
}
