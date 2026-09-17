/* ============================================================================
   WWN — страница статьи вики (ES-модуль)
   Оболочка (шапка, сайдбар, поиск) — в wiki-shell.js.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, initLangSwitch, registerDictLoaders, t } from "./i18n.js";
import { $, abs, emptyBlock, formatDate, loc } from "./utils.js";
import { initHeader, initYear } from "./ui.js";
import { applyResponsiveImages } from "./media.js";

registerDictLoaders({
  ru: () => import("./i18n/wiki.ru.js"),
  en: () => import("./i18n/wiki.en.js")
});

/* Оболочку вики (сайдбар, поиск, реестр статей) подтягиваем асинхронно:
   переводы и каркас появляются раньше, чем она нужна. */
let buildHome, getFlatArticles, initShell, parseFrontMatter;

/* marked и DOMPurify грузим только на странице статьи, чтобы каталог вики не тянул vendor. */
let vendorPromise = null;
const loadVendor = () => {
  vendorPromise ||= Promise.all([
    import("../vendor/marked.esm.js"),
    import("../vendor/purify.esm.js")
  ])
    .then(([markedMod, purifyMod]) => ({ marked: markedMod.marked, DOMPurify: purifyMod.default }))
    .catch((error) => {
      vendorPromise = null; // следующий вызов попробует загрузить заново
      throw error;
    });
  return vendorPromise;
};
/** Сноски в стиле вики: `текст[^1]` + определения `[^1]: пояснение`.
 *  Определения вырезаются до markdown-разбора, ссылки заменяются верхними
 *  индексами; сам блок примечаний собирается в renderMarkdown. */
function processFootnotes(markdown) {
  const defs = new Map();
  const body = markdown.replace(/^\[\^([\w.-]+)\]:[ \t]*(.+?)[ \t]*$/gm, (match, id, text) => {
    defs.set(id, text);
    return "";
  });
  if (!defs.size) return { body: markdown, items: [] };

  const numbers = new Map();
  const used = new Map();
  const withRefs = body.replace(/\[\^([\w.-]+)\]/g, (match, id) => {
    if (!defs.has(id)) return match;
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    const count = (used.get(id) || 0) + 1;
    used.set(id, count);
    const refId = count === 1 ? `fnref-${id}` : `fnref-${id}-${count}`;
    return `<sup class="article__ref"><a href="#fn-${id}" id="${refId}" role="doc-noteref">[${numbers.get(id)}]</a></sup>`;
  });

  const items = [...defs.entries()].map(([id, text]) => ({ id, text, number: numbers.get(id) || 0 }));
  items.sort((a, b) => a.number - b.number);
  return { body: withRefs, items };
}

function renderMarkdown(markdown, slug, lang, { marked, DOMPurify }) {
  const { body, items: footnotes } = processFootnotes(markdown);
  const sanitized = DOMPurify.sanitize(marked.parse(body, { gfm: true }), {
    ADD_ATTR: ["target", "rel", "id", "controls", "preload"]
  });
  const holder = document.createElement("div");
  holder.innerHTML = sanitized;

  const usedIds = new Set();
  holder.querySelectorAll("h1, h2, h3").forEach((heading) => {
    const base = heading.textContent.trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 64) || "section";
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    heading.id = id;
  });

  // «Источники» / «См. также» — компактный блок со списком в конце статьи
  const SOURCES_TITLES = ["источники", "ссылки", "внешние ссылки", "см. также", "sources", "links", "external links", "see also", "references"];
  holder.querySelectorAll("h2, h3").forEach((heading) => {
    if (!SOURCES_TITLES.includes(heading.textContent.trim().toLowerCase())) return;
    heading.classList.add("article__sources-title");
    let node = heading.nextElementSibling;
    while (node && !/^H[1-6]$/.test(node.tagName)) {
      if (node.tagName === "UL" || node.tagName === "OL") node.classList.add("article__sources");
      node = node.nextElementSibling;
    }
  });

  // Примечания к сноскам [^id] — с обратными ссылками к тексту
  if (footnotes.length) {
    const section = document.createElement("section");
    section.className = "article__refs";
    const title = document.createElement("h2");
    title.id = "refs";
    title.textContent = t("wiki.notes", lang);
    const list = document.createElement("ol");
    footnotes.forEach((note) => {
      const item = document.createElement("li");
      item.id = `fn-${note.id}`;
      item.innerHTML = DOMPurify.sanitize(marked.parseInline(note.text));
      const back = document.createElement("a");
      back.className = "article__ref-back";
      back.href = `#fnref-${note.id}`;
      back.setAttribute("role", "doc-backlink");
      back.setAttribute("aria-label", t("wiki.refBack", lang));
      back.textContent = "↑";
      item.append(" ", back);
      list.append(item);
    });
    section.append(title, list);
    holder.append(section);
  }

  const articles = getFlatArticles();
  const knownSlugs = new Set(articles.map((article) => article.slug));

  holder.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (/^(https?:)?\/\//i.test(href)) {
      // внешний источник — помечаем, чтобы отличался от ссылок по вики
      link.target = "_blank";
      link.rel = "noopener";
      link.classList.add("wiki-link--external");
      return;
    }
    if (href.startsWith("mailto:")) {
      link.target = "_blank";
      link.rel = "noopener";
      return;
    }
    if (href.startsWith("#")) return;
    const hashAt = href.indexOf("#");
    const pathPart = hashAt === -1 ? href : href.slice(0, hashAt);
    const hashPart = hashAt === -1 ? "" : href.slice(hashAt);
    if (!/\.md$/i.test(pathPart)) return; // не статья — оставляем ссылку как есть
    // резолвим относительно адреса markdown-файла, поэтому работают любые ../
    const resolved = new URL(pathPart, `https://wwn.local/content/${lang}/${slug}.md`);
    const target = resolved.pathname.replace(/^\/content\/[^/]+\//, "").replace(/\.md$/i, "");
    link.href = `article.html?p=${target}${hashPart}`;
    // «красная ссылка» — статьи ещё нет в реестре вики
    if (knownSlugs.size && !knownSlugs.has(target)) {
      link.classList.add("wiki-link--missing");
      link.title = t("wiki.linkMissing", lang);
    }
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

  holder.querySelectorAll("img").forEach((img) => {
    img.loading = "lazy";
    img.decoding = "async";
  });
  applyResponsiveImages(holder, "(max-width: 900px) 100vw, 900px");

  return holder;
}

/** Прокрутка к якорю после асинхронной загрузки статьи. */
function scrollToHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(hash));
  } catch {
    target = document.getElementById(hash);
  }
  if (!target) return;
  // смещение задаёт CSS scroll-padding-top (высота шапки + safe-area)
  target.scrollIntoView({ block: "start" });
}

function buildToc(holder, lang) {
  const headings = [...holder.querySelectorAll("h2, h3")];
  if (headings.length < 3) return null;

  const box = document.createElement("details");
  box.className = "article__toc";
  const title = document.createElement("summary");
  title.textContent = t("wiki.toc", lang);
  const list = document.createElement("ol");
  headings.forEach((heading) => {
    const li = document.createElement("li");
    if (heading.tagName === "H3") li.className = "lvl-3";
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    li.append(link);
    list.append(li);
  });
  box.append(title, list);
  // на десктопе список раскрыт, на мобильных — свёрнут (высота зарезервирована в CSS)
  box.open = !window.matchMedia("(max-width: 1240px)").matches;
  return box;
}

let tocCleanup = null;

function initTocSpy(links, headings, root) {
  tocCleanup?.();
  if (!links.length || !headings.length) return;

  let offsets = [];
  let ticking = false;

  const measure = () => {
    offsets = headings.map((heading) => heading.getBoundingClientRect().top + window.scrollY);
  };
  const update = () => {
    ticking = false;
    const line = window.scrollY + 120;
    let current = 0;
    for (let i = 0; i < offsets.length; i++) if (offsets[i] <= line) current = i;
    links.forEach((link, i) => link.classList.toggle("is-active", i === current));
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  const remeasure = () => {
    measure();
    schedule();
  };

  measure();
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", remeasure);
  document.fonts.ready.then(remeasure).catch(() => {});
  const observer = root ? new ResizeObserver(remeasure) : null;
  observer?.observe(root);
  tocCleanup = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", remeasure);
    observer?.disconnect();
    tocCleanup = null;
  };
}

function addHeadingAnchors(holder) {
  holder.querySelectorAll("h2, h3").forEach((heading) => {
    const anchor = document.createElement("a");
    anchor.className = "article__anchor";
    anchor.href = `#${heading.id}`;
    anchor.setAttribute("aria-label", heading.textContent.trim());
    anchor.textContent = "#";
    heading.append(anchor);
  });
}

function initCopyButtons(holder, lang) {
  holder.querySelectorAll("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code || pre.querySelector(".article__copy")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "article__copy";
    button.textContent = t("wiki.copy", lang);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = t("wiki.copied", lang);
        button.classList.add("is-done");
        setTimeout(() => {
          button.textContent = t("wiki.copy", lang);
          button.classList.remove("is-done");
        }, 1600);
      } catch {}
    });
    pre.append(button);
  });
}
let articleSeq = 0;

function renderNotFound(body, lang, titleEl, crumbs, metaEl, pager) {
  tocCleanup?.();
  body.classList.remove("is-ready");
  body.replaceChildren();
  $("#articleAside")?.replaceChildren();

  const callout = document.createElement("div");
  callout.className = "callout";
  const heading = document.createElement("h3");
  heading.textContent = t("wiki.notFound.title", lang);
  const desc = document.createElement("p");
  desc.textContent = t("wiki.notFound.desc", lang);
  const back = document.createElement("p");
  const link = document.createElement("a");
  link.href = "./";
  link.textContent = t("wiki.back", lang);
  back.append(link);
  callout.append(heading, desc, back);
  body.append(callout);

  if (titleEl) titleEl.textContent = t("wiki.notFound.title", lang);
  document.title = `${t("wiki.notFound.title", lang)} — ${t("meta.title.wiki", lang)}`;
  crumbs?.replaceChildren();
  metaEl?.replaceChildren();
  pager?.replaceChildren();
}

function buildCrumbs(crumbs, article, lang) {
  const separator = () => {
    const span = document.createElement("span");
    span.className = "sep";
    span.textContent = "/";
    return span;
  };
  const item = (text, href) => {
    if (!href) {
      const span = document.createElement("span");
      span.textContent = text;
      return span;
    }
    const link = document.createElement("a");
    link.href = href;
    link.textContent = text;
    return link;
  };
  crumbs.replaceChildren(
    item(t("nav.wiki", lang), "./"),
    separator(),
    item(loc(article.category.title, lang), "../database.html"),
    separator(),
    item(loc(article.title, lang))
  );
}

/** Заголовок и описание статьи; canonical/og:url/hreflang обновляет i18n.applyMeta. */
function applyArticleMeta(title, description, lang) {
  document.title = `${title} — ${t("meta.title.wiki", lang)}`;
  const setContent = (selector, value) => document.querySelector(selector)?.setAttribute("content", value);
  setContent('meta[name="description"]', description);
  setContent('meta[property="og:title"]', title);
  setContent('meta[property="og:description"]', description);
  setContent('meta[name="twitter:title"]', title);
  setContent('meta[name="twitter:description"]', description);
}

async function loadArticle(slug, lang) {
  const body = $("#articleBody");
  if (!body) return;
  const seq = ++articleSeq;

  const titleEl = $("#articleTitle");
  const crumbs = $("#crumbs");
  const metaEl = $("#articleMeta");
  const pager = $("#articlePager");
  const articles = getFlatArticles();
  const article = articles.find((item) => item.slug === slug);

  // Защита от path traversal: slug допускается только из реестра статей,
  // а если реестр недоступен — только по строгой маске пути (без «..»).
  const slugPattern = /^[\w-]+(?:\/[\w-]+)*$/;
  const allowed = slugPattern.test(slug) && !slug.includes("..");
  if (!allowed || (articles.length && !article)) {
    renderNotFound(body, lang, titleEl, crumbs, metaEl, pager);
    return;
  }

  let raw;
  try {
    const res = await fetch(abs(`content/${lang}/${slug}.md?v=${WWN_CONFIG.version}`));
    if (!res.ok) throw new Error(String(res.status));
    raw = await res.text();
  } catch {
    if (seq !== articleSeq) return;
    renderNotFound(body, lang, titleEl, crumbs, metaEl, pager);
    return;
  }
  if (seq !== articleSeq) return;

  const { meta, body: markdown } = parseFrontMatter(raw);
  let vendor;
  try {
    vendor = await loadVendor();
  } catch {
    if (seq !== articleSeq) return;
    body.classList.remove("is-ready");
    body.replaceChildren(emptyBlock(t("wiki.loadError.desc", lang)));
    return;
  }
  if (seq !== articleSeq) return;
  const holder = renderMarkdown(markdown, slug, lang, vendor);
  const title = meta.title || loc(article?.title, lang) || slug;

  if (titleEl) titleEl.textContent = title;
  applyArticleMeta(title, loc(article?.desc, lang) || t("wiki.subtitle", lang), lang);

  if (crumbs && article) buildCrumbs(crumbs, article, lang);

  if (metaEl) {
    const words = markdown.split(/\s+/).length;
    const bits = [];
    if (article) bits.push(loc(article.category.title, lang));
    bits.push(`${Math.max(1, Math.round(words / 180))} ${t("wiki.readingTime", lang)}`);
    if (meta.updated) bits.push(`${t("wiki.updated", lang)}: ${formatDate(meta.updated, lang)}`);
    metaEl.replaceChildren(
      ...bits.map((bit) => {
        const span = document.createElement("span");
        span.textContent = bit;
        return span;
      })
    );
    if (meta.draft === true) {
      const badge = document.createElement("span");
      badge.className = "badge-draft";
      badge.textContent = t("wiki.draft", lang);
      metaEl.append(badge);
    }
  }

  const aside = $("#articleAside");
  body.classList.remove("is-ready");
  body.replaceChildren();

  const toc = buildToc(holder, lang);
  addHeadingAnchors(holder);
  initCopyButtons(holder, lang);
  body.append(holder);

  if (aside) {
    aside.replaceChildren();
    if (toc) aside.append(toc);
  } else if (toc) {
    body.prepend(toc);
  }
  initTocSpy(toc ? [...toc.querySelectorAll("a")] : [], [...holder.querySelectorAll("h2, h3")], holder);

  requestAnimationFrame(() => {
    body.classList.add("is-ready");
    scrollToHash();
    // подстраховка: картинки могли догрузиться и сдвинуть вёрстку
    setTimeout(scrollToHash, 300);
  });

  if (pager) {
    const index = articles.findIndex((item) => item.slug === slug);
    const prev = index > 0 ? articles[index - 1] : null;
    const next = index > -1 && index < articles.length - 1 ? articles[index + 1] : null;
    pager.replaceChildren();

    const pagerLink = (item, className, label, arrow) => {
      const link = document.createElement("a");
      if (className) link.className = className;
      link.href = `article.html?p=${item.slug}`;
      const small = document.createElement("small");
      small.textContent = arrow === "left" ? `← ${label}` : `${label} →`;
      const strong = document.createElement("b");
      strong.textContent = loc(item.title, lang);
      const category = document.createElement("span");
      category.className = "article__pager-cat";
      category.textContent = loc(item.category?.title, lang);
      link.append(small, strong, category);
      return link;
    };

    if (prev) pager.append(pagerLink(prev, "", t("wiki.prev", lang), "left"));
    if (next) pager.append(pagerLink(next, "pager-next", t("wiki.next", lang), "right"));
  }
}
async function boot() {
  initHeader();
  initYear();
  initLangSwitch();
  await bootI18n();
  const slug = new URLSearchParams(location.search).get("p");
  const isArticlePage = Boolean($("#articleBody"));
  if (isArticlePage && !slug) {
    location.replace("./");
    return;
  }

  ({ buildHome, getFlatArticles, initShell, parseFrontMatter } = await import("./wiki-shell.js"));

  await initShell({
    slug,
    onRender: (lang) => {
      if (isArticlePage) return loadArticle(slug, lang);
      if ($("#wikiCategories")) {
        document.title = t("meta.title.wikiHome", lang);
        buildHome(lang);
      }
    }
  });
}

boot();
