/* ============================================================================
   WWN — движок вики (ES-модуль): навигация, статьи, поиск
   ============================================================================ */

import { marked } from "../vendor/marked.esm.js";
import DOMPurify from "../vendor/purify.esm.js";
import { getLang, setLang, t, applyI18n, bootI18n, initLangSwitch, setPageTitle } from "./i18n.js";
import { $, $$, abs, initHeader, initReveal, prefersReduced } from "./ui.js";

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

const loc = (obj, lang) => (obj ? obj[lang] || obj.ru || obj.en || "" : "");

/* ------------------------------------------------------------------- nav -- */
function indexNav() {
  flatArticles = [];
  navData.categories.forEach((cat) => {
    cat.articles.forEach((article) => flatArticles.push({ ...article, category: cat }));
  });
}

async function loadNav() {
  try {
    const cached = sessionStorage.getItem("wwn-nav-cache-v1");
    if (cached) {
      navData = JSON.parse(cached);
      indexNav();
    }
  } catch (e) {}

  const res = await fetch(abs("data/wiki-nav.json"), { cache: "no-cache" });
  if (!res.ok) {
    if (navData) return navData;
    throw new Error("nav");
  }
  navData = await res.json();
  try { sessionStorage.setItem("wwn-nav-cache-v1", JSON.stringify(navData)); } catch (e) {}
  indexNav();
  return navData;
}

function buildSidebar(lang, activeSlug) {
  const nav = $("#wikiNav");
  if (!nav || !navData) return;
  nav.replaceChildren(
    ...navData.categories.map((cat) => {
      const group = document.createElement("div");
      group.className = "wiki-nav__group";
      group.innerHTML = `<h4>${ICONS[cat.icon] || ICONS.book}<span>${loc(cat.title, lang)}</span></h4>`;
      const list = document.createElement("ul");
      cat.articles.forEach((article) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `article.html?p=${encodeURIComponent(article.slug)}`;
        link.textContent = loc(article.title, lang);
        if (article.slug === activeSlug) link.className = "is-active";
        li.append(link);
        list.append(li);
      });
      group.append(list);
      return group;
    })
  );
}

/* -------------------------------------------------------------- wiki home -- */
function buildHome(lang) {
  const grid = $("#wikiCategories");
  if (!grid || !navData) return;

  const stats = $("#wikiHeroStats");
  if (stats) {
    stats.innerHTML =
      `<span><b>${navData.categories.length}</b>${t("wiki.stats.sections", lang)}</span>` +
      `<span><b>${flatArticles.length}</b>${t("wiki.articles", lang)}</span>` +
      `<span><b>2</b>${t("wiki.stats.factions", lang)}</span>`;
  }

  grid.replaceChildren(
    ...navData.categories.map((cat, i) => {
      const card = document.createElement("section");
      card.className = "wiki-cat";
      card.dataset.reveal = "";
      card.style.transitionDelay = `${i * 60}ms`;

      const count = document.createElement("span");
      count.className = "wiki-cat__count";
      count.textContent = `${cat.articles.length} ${t("wiki.articles", lang)}`;

      const icon = document.createElement("div");
      icon.className = "wiki-cat__icon";
      icon.innerHTML = ICONS[cat.icon] || ICONS.book;

      const title = document.createElement("h3");
      title.textContent = loc(cat.title, lang);
      const desc = document.createElement("p");
      desc.textContent = loc(cat.desc, lang);

      const list = document.createElement("ul");
      cat.articles.slice(0, 5).forEach((article) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `article.html?p=${encodeURIComponent(article.slug)}`;
        link.textContent = loc(article.title, lang);
        li.append(link);
        list.append(li);
      });

      card.append(count, icon, title, desc, list);
      return card;
    })
  );
  initReveal(grid);
}

/* ---------------------------------------------------------------- article -- */
function parseFrontMatter(raw) {
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

function renderMarkdown(markdown, slug) {
  const sanitized = DOMPurify.sanitize(marked.parse(markdown, { gfm: true }), {
    ADD_ATTR: ["target", "rel", "id", "controls", "preload", "src"]
  });
  const holder = document.createElement("div");
  holder.innerHTML = sanitized;

  const dir = slug.includes("/") ? slug.split("/").slice(0, -1).join("/") : "";

  holder.querySelectorAll("h1, h2, h3").forEach((heading, i) => {
    const text = heading.textContent.trim();
    heading.id =
      "s-" + slug.split("/").pop() + "-" + i + "-" +
      text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 48);
  });

  holder.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (/^(https?:)?\/\//i.test(href) || href.startsWith("mailto:")) {
      link.target = "_blank";
      link.rel = "noopener";
      return;
    }
    if (href.startsWith("#")) return;
    let target = href.replace(/\.md$/i, "");
    if (!target.includes("/") && dir) target = `${dir}/${target}`;
    target = target.replace(/^\.\//, "").replace(/^\.\.\//, "");
    link.href = `article.html?p=${encodeURIComponent(target)}`;
  });

  // одиночные картинки — в фигуры с подписью из alt
  holder.querySelectorAll("p").forEach((paragraph) => {
    const images = [...paragraph.querySelectorAll("img")];
    if (!images.length) return;
    if (images.length === 1 && paragraph.textContent.trim() === "") {
      const img = images[0];
      const figure = document.createElement("figure");
      figure.className = "article__figure";
      img.replaceWith(figure);
      figure.append(img);
      const alt = img.getAttribute("alt");
      if (alt) {
        const caption = document.createElement("figcaption");
        caption.textContent = alt;
        figure.append(caption);
      }
    } else {
      paragraph.classList.add("article__gallery");
      images.forEach((img) => img.getAttribute("alt") && img.setAttribute("title", img.getAttribute("alt")));
    }
  });

  return holder;
}

function buildToc(holder, lang) {
  const headings = [...holder.querySelectorAll("h2, h3")];
  if (headings.length < 3) return null;

  const box = document.createElement("nav");
  box.className = "article__toc";
  const title = document.createElement("h4");
  title.textContent = t("wiki.toc", lang);
  const list = document.createElement("ol");
  headings.forEach((heading) => {
    const li = document.createElement("li");
    li.className = heading.tagName === "H3" ? "lvl-3" : "lvl-2";
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    li.append(link);
    list.append(li);
  });
  box.append(title, list);
  return box;
}

async function loadArticle(slug, lang) {
  const body = $("#articleBody");
  if (!body) return;

  const titleEl = $("#articleTitle");
  const crumbs = $("#crumbs");
  const metaEl = $("#articleMeta");
  const pager = $("#articlePager");
  const article = flatArticles.find((item) => item.slug === slug);

  let raw;
  try {
    const res = await fetch(abs(`content/${lang}/${slug}.md`), { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    raw = await res.text();
  } catch (e) {
    body.classList.remove("is-ready");
    body.innerHTML = `<div class="callout">
      <h3>${t("wiki.notFound.title", lang)}</h3>
      <p>${t("wiki.notFound.desc", lang)}</p>
      <p><a href="./">${t("wiki.back", lang)}</a></p>
    </div>`;
    titleEl && (titleEl.textContent = t("wiki.notFound.title", lang));
    crumbs && crumbs.replaceChildren();
    metaEl && metaEl.replaceChildren();
    pager && pager.replaceChildren();
    return;
  }

  const { meta, body: markdown } = parseFrontMatter(raw);
  const holder = renderMarkdown(markdown, slug);
  const title = meta.title || loc(article?.title, lang) || slug;

  if (titleEl) titleEl.textContent = title;
  document.title = `${title} — ${t("meta.title.wiki", lang)}`;

  if (crumbs && article) {
    crumbs.innerHTML =
      `<a href="./">${t("nav.wiki", lang)}</a><span class="sep">/</span>` +
      `<a href="catalog.html">${loc(article.category.title, lang)}</a><span class="sep">/</span>` +
      `<span>${loc(article.title, lang)}</span>`;
  }

  if (metaEl) {
    const words = markdown.split(/\s+/).length;
    const bits = [];
    if (article) bits.push(loc(article.category.title, lang));
    bits.push(`${Math.max(1, Math.round(words / 180))} ${t("wiki.readingTime", lang)}`);
    if (meta.updated) bits.push(`${t("wiki.updated", lang)}: ${new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${meta.updated}T00:00:00`))}`);
    metaEl.innerHTML = bits.map((bit) => `<span>${bit}</span>`).join("");
    if (meta.draft === true) {
      const badge = document.createElement("span");
      badge.className = "badge-draft";
      badge.textContent = t("wiki.draft", lang);
      metaEl.append(badge);
    }
  }

  body.classList.remove("is-ready");
  body.replaceChildren();
  const toc = buildToc(holder, lang);
  if (toc) body.append(toc);
  body.append(holder);
  requestAnimationFrame(() => body.classList.add("is-ready"));

  if (pager) {
    const index = flatArticles.findIndex((item) => item.slug === slug);
    const prev = index > 0 ? flatArticles[index - 1] : null;
    const next = index > -1 && index < flatArticles.length - 1 ? flatArticles[index + 1] : null;
    pager.replaceChildren();

    if (prev) {
      const link = document.createElement("a");
      link.href = `article.html?p=${encodeURIComponent(prev.slug)}`;
      link.innerHTML = `<small>← ${t("wiki.prev", lang)}</small><b>${loc(prev.title, lang)}</b>`;
      pager.append(link);
    }
    if (next) {
      const link = document.createElement("a");
      link.className = "pager-next";
      link.href = `article.html?p=${encodeURIComponent(next.slug)}`;
      link.innerHTML = `<small>${t("wiki.next", lang)} →</small><b>${loc(next.title, lang)}</b>`;
      pager.append(link);
    }
  }
}

/* ------------------------------------------------------------------ search -- */
const stripMd = (markdown) =>
  parseFrontMatter(markdown).body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

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

async function buildSearchIndex(lang) {
  if (searchIndex && searchIndexLang === lang) return searchIndex;
  if (searchLoading && searchIndexLang === lang) return searchLoading;
  searchIndexLang = lang;

  searchLoading = Promise.all(
    flatArticles.map(async (article) => {
      try {
        const res = await fetch(abs(`content/${lang}/${article.slug}.md`), { cache: "force-cache" });
        const raw = res.ok ? await res.text() : "";
        return { ...article, text: stripMd(raw) };
      } catch (e) {
        return { ...article, text: "" };
      }
    })
  ).then((items) => {
    searchIndex = items;
    searchLoading = null;
    return searchIndex;
  });

  return searchLoading;
}

async function runSearch(query, lang) {
  const results = $("#searchResults");
  const hint = $("#searchHint");
  if (!results) return;

  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    results.replaceChildren();
    hint && (hint.style.display = "");
    return;
  }
  hint && (hint.style.display = "none");

  const items = await buildSearchIndex(lang);
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

  if (!found.length) {
    results.innerHTML = `<div class="catalog-empty">${t("wiki.search.empty", lang)}</div>`;
    return;
  }

  results.replaceChildren(
    ...found.slice(0, 12).map(({ item, title, category }) => {
      const link = document.createElement("a");
      link.className = "search-result";
      link.href = `article.html?p=${encodeURIComponent(item.slug)}`;
      link.innerHTML =
        `<b>${highlight(title, query.trim())}</b>` +
        `<small>${category}</small>` +
        `<p>${highlight(snippet(item.text, needle), query.trim())}</p>`;
      return link;
    })
  );
}

function initSearch(lang) {
  const panel = $("#searchPanel");
  if (!panel) return;
  const input = $("#searchPanelInput");
  const sideInput = $("#searchInput");
  const results = $("#searchResults");
  const hint = $("#searchHint");

  let currentLang = lang;

  const openPanel = (seed = "") => {
    if (!panel.open) panel.showModal();
    if (seed || input.value) input.value = seed;
    input.focus();
    input.select();
    runSearch(input.value, currentLang);
  };

  $("#searchOpen")?.addEventListener("click", () => openPanel());
  sideInput?.addEventListener("focus", () => {
    const seed = sideInput.value;
    sideInput.blur();
    openPanel(seed);
  });

  input?.addEventListener("input", () => runSearch(input.value, currentLang));

  panel.addEventListener("click", (event) => {
    if (event.target === panel) panel.close();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPanel();
    }
  });

  return (nextLang) => { currentLang = nextLang; };
}

/* ------------------------------------------------------------ lang / boot -- */
function applyLangVisuals(lang) {
  document.body.style.setProperty("--wiki-hero-img", `url("${abs(`assets/img/lore/tc-${lang === "en" ? "en" : "ru"}.webp`)}")`);
}

async function boot() {
  let lang = bootI18n();
  initHeader();
  applyLangVisuals(lang);

  try {
    await loadNav();
  } catch (e) {
    const message = t("wiki.loadError.desc", lang);
    const nav = $("#wikiNav");
    if (nav) nav.innerHTML = `<p style="color: var(--muted); font-size: 13.5px">${message}</p>`;
    const home = $("#wikiCategories");
    if (home) home.innerHTML = `<div class="catalog-empty">${message}</div>`;
    return;
  }

  const slug = new URLSearchParams(location.search).get("p");
  const isArticlePage = Boolean($("#articleBody"));
  const isWikiHome = Boolean($("#wikiCategories"));

  const render = async (nextLang) => {
    if (isArticlePage && slug) {
      buildSidebar(nextLang, slug);
      await loadArticle(slug, nextLang);
    } else if (isArticlePage) {
      location.replace("./");
    } else if (isWikiHome) {
      document.title = t("meta.title.wikiHome", nextLang);
      buildSidebar(nextLang, null);
      buildHome(nextLang);
    } else {
      // страницы-спутники (например, каталог): только сайдбар
      buildSidebar(nextLang, null);
    }
  };

  const setSearchLang = initSearch(lang) || (() => {});
  await render(lang);

  initLangSwitch();
  document.addEventListener("wwn:langchange", async (event) => {
    lang = event.detail.lang;
    searchIndex = null;
    applyLangVisuals(lang);
    setSearchLang(lang);
    await render(lang);
  });
}

boot();
