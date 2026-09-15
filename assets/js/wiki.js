/* ============================================================================
   WWN — страница статьи вики (ES-модуль)
   Оболочка (шапка, сайдбар, поиск) — в wiki-shell.js.
   ============================================================================ */

import { marked } from "../vendor/marked.esm.js";
import DOMPurify from "../vendor/purify.esm.js";
import { WWN_CONFIG } from "./site-config.js";
import { t } from "./i18n.js";
import { $, abs, formatDate, loc, prefersReduced } from "./utils.js";
import { applyResponsiveImages } from "./media.js";
import { buildHome, getFlatArticles, initShell, parseFrontMatter } from "./wiki-shell.js";

/* -------------------------------------------------------------- markdown -- */
function renderMarkdown(markdown, slug) {
  const sanitized = DOMPurify.sanitize(marked.parse(markdown, { gfm: true }), {
    ADD_ATTR: ["target", "rel", "id", "controls", "preload"]
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
    const hashAt = href.indexOf("#");
    const pathPart = hashAt === -1 ? href : href.slice(0, hashAt);
    const hashPart = hashAt === -1 ? "" : href.slice(hashAt);
    let target = pathPart.replace(/\.md$/i, "");
    if (!target.includes("/") && dir) target = `${dir}/${target}`;
    target = target.replace(/^\.\//, "").replace(/^\.\.\//, "");
    link.href = `article.html?p=${encodeURIComponent(target)}${hashPart}`;
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
  const top = target.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
}

function buildToc(holder, lang) {
  const headings = [...holder.querySelectorAll("h2, h3")];
  if (headings.length < 3) return null;

  const box = document.createElement("nav");
  box.className = "article__toc";
  const title = document.createElement("h4");
  title.textContent = t("wiki.toc", lang);
  const list = document.createElement("ol");
  list.className = "article__toc-list";
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
  return box;
}

let tocCleanup = null;

function initTocSpy(links, headings) {
  tocCleanup?.();
  if (!links.length || !headings.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const line = window.scrollY + 120;
    let current = 0;
    headings.forEach((heading, i) => {
      if (heading.getBoundingClientRect().top + window.scrollY <= line) current = i;
    });
    links.forEach((link, i) => link.classList.toggle("is-active", i === current));
  };
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  tocCleanup = () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
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

/* ---------------------------------------------------------------- article -- */
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
  const holder = renderMarkdown(markdown, slug);
  const title = meta.title || loc(article?.title, lang) || slug;

  if (titleEl) titleEl.textContent = title;
  document.title = `${title} — ${t("meta.title.wiki", lang)}`;

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
  initTocSpy(toc ? [...toc.querySelectorAll("a")] : [], [...holder.querySelectorAll("h2, h3")]);

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
      link.href = `article.html?p=${encodeURIComponent(item.slug)}`;
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

/* ------------------------------------------------------------------- boot -- */
async function boot() {
  const slug = new URLSearchParams(location.search).get("p");
  const isArticlePage = Boolean($("#articleBody"));
  if (isArticlePage && !slug) {
    location.replace("./");
    return;
  }

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
