/* ============================================================================
   WWN — сборка вики из контента.
   ----------------------------------------------------------------------------
   Читает content/<язык>/<раздел>/*.md и data/wiki-sections.json, пишет:

     data/wiki-nav.json             — разделы и опубликованные статьи
     data/search-index-<язык>.json  — полнотекстовый индекс (без черновиков)
     data/wiki-related.json         — «Читать также» (граф ссылок между статьями)
     wiki/<раздел>/<статья>/index.html — статические страницы статей
     sitemap.xml                    — карта сайта

   Запуск из корня репозитория:
     node tools/build-wiki.mjs           # собрать
     node tools/build-wiki.mjs --check   # проверить без записи (сверяет файлы)
   ============================================================================ */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontMatter, stripMd } from "../assets/js/md-text.js";

const LANGS = ["ru", "en"];
const SITE = "https://wwn-games.github.io/WWN.site";
const TEMPLATE = "tools/templates/article.html";
const CHECK = process.argv.includes("--check");

const errors = [];
const warnings = [];
const error = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

/* ---------------------------------------------------------------- контент -- */

const sections = JSON.parse(readFileSync("data/wiki-sections.json", "utf8")).sections
  .slice()
  .sort((a, b) => a.order - b.order);

const sectionIds = new Set(sections.map((s) => s.id));

/** Шапка статьи: title/desc обязаны быть в кавычках — иначе любой YAML-парсер
    (редактор, утилита) спотыкается о двоеточие или решётку внутри значения. */
function checkQuotedFields(slug, lang, raw) {
  const block = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!block) return;
  for (const line of block[1].split("\n")) {
    const match = line.match(/^(title|desc):[ \t]*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!/^(["']).*\1$/.test(value)) {
      error(`${slug} (${lang}): ${key} без кавычек — возьмите значение в двойные кавычки`);
      continue;
    }
    const inner = value.slice(1, -1);
    if (value[0] === '"' && inner.includes('"')) error(`${slug} (${lang}): в ${key} есть кавычка — используйте одинарные`);
    if (value[0] === "'" && inner.includes("'")) error(`${slug} (${lang}): в ${key} есть апостроф — используйте двойные`);
  }
}

// content/<язык>/<раздел>/<файл>.md → { slug → { ru: {meta, body, raw}, en: {...} } }
const parsed = new Map();
for (const section of sections) {
  for (const lang of LANGS) {
    const dir = join("content", lang, section.id);
    if (!existsSync(dir)) {
      error(`нет папки content/${lang}/${section.id} (раздел «${section.id}»)`);
      continue;
    }
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".md")).sort()) {
      const slug = `${section.id}/${name.slice(0, -3)}`;
      const raw = readFileSync(join(dir, name), "utf8");
      checkQuotedFields(slug, lang, raw);
      if (!parsed.has(slug)) parsed.set(slug, {});
      parsed.get(slug)[lang] = { ...parseFrontMatter(raw), raw };
    }
  }
}

// файлы и папки вне разделов
for (const lang of LANGS) {
  const root = join("content", lang);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!sectionIds.has(entry.name)) error(`папка content/${lang}/${entry.name} не описана в data/wiki-sections.json`);
      continue;
    }
    if (entry.name.endsWith(".md")) error(`content/${lang}/${entry.name}: статью нужно положить в папку раздела`);
  }
}

/** Цели внутренних .md-ссылок: тело статьи → slug'и. */
function linkTargets(body, slug, lang) {
  const targets = new Set();
  for (const match of body.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) {
    const href = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const path = new URL(href, `https://wwn.local/content/${lang}/${slug}.md`).pathname;
    targets.add(path.replace(`/content/${lang}/`, "").replace(/\.md$/, ""));
  }
  return targets;
}

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (ch) => ESCAPE[ch]);
const escapeXml = (value) => escapeHtml(value).replace(/'/g, "&apos;");
const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

const articles = [...parsed.entries()].map(([slug, langs]) => {
  const ru = langs.ru;
  const en = langs.en;
  if (!ru) error(`нет RU-версии: content/ru/${slug}.md`);
  if (!en) error(`нет EN-версии: content/en/${slug}.md`);
  const source = ru || en;
  const order = Number.parseInt(source.meta.order, 10);
  if (!Number.isFinite(order)) error(`${slug}: во front matter нужен числовой order`);
  if (!source.meta.title) error(`${slug}: во front matter нужен title`);
  if (!source.meta.desc) warn(`${slug}: нет desc — не будет описания в меню и поиске`);
  if (ru && en && (ru.meta.draft === true) !== (en.meta.draft === true)) warn(`${slug}: draft не совпадает в RU и EN`);
  if (ru && en && Number.parseInt(ru.meta.order, 10) !== Number.parseInt(en.meta.order, 10)) warn(`${slug}: order не совпадает в RU и EN`);
  return {
    slug,
    section: slug.split("/")[0],
    order: Number.isFinite(order) ? order : 999,
    updated: day(source.meta.updated),
    draft: source.meta.draft === true,
    title: { ru: ru?.meta.title || en?.meta.title || slug, en: en?.meta.title || ru?.meta.title || slug },
    desc: { ru: ru?.meta.desc || en?.meta.desc || "", en: en?.meta.desc || ru?.meta.desc || "" },
    body: { ru: ru?.body || "", en: en?.body || "" },
    links: new Set([...linkTargets(ru?.body || "", slug, "ru"), ...linkTargets(en?.body || "", slug, "en")])
  };
});

// порядок внутри раздела: order, затем заголовок
const bySection = (id) =>
  articles
    .filter((a) => a.section === id)
    .sort((a, b) => a.order - b.order || a.title.ru.localeCompare(b.title.ru, "ru"));

const allSlugs = new Set(articles.map((a) => a.slug));
for (const article of articles) {
  for (const target of article.links) {
    if (!allSlugs.has(target)) warn(`${article.slug}: ссылка на несуществующую статью «${target}»`);
  }
}

// дубли order внутри раздела
for (const section of sections) {
  const orders = bySection(section.id).map((a) => a.order);
  if (new Set(orders).size !== orders.length) error(`раздел «${section.id}»: одинаковый order у нескольких статей`);
}

const published = articles.filter((a) => !a.draft);

/* -------------------------------------------------------------- генерация -- */

// nav: только опубликованные статьи; разделы без статей не показываем.
// Черновики лежат отдельным списком — по прямой ссылке они открываются,
// но в меню, поиске и на хабе их нет.
const sectionMeta = (section) => ({
  id: section.id,
  icon: section.icon,
  title: section.title,
  desc: section.desc
});
const nav = {
  categories: sections
    .map((section) => ({
      ...sectionMeta(section),
      articles: bySection(section.id)
        .filter((a) => !a.draft)
        .map((a) => ({ slug: a.slug, title: a.title, desc: a.desc, updated: a.updated }))
    }))
    .filter((category) => category.articles.length),
  drafts: articles
    .filter((a) => a.draft)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      desc: a.desc,
      updated: a.updated,
      draft: true,
      category: sectionMeta(sections.find((s) => s.id === a.section))
    }))
};

// поисковый индекс: без черновиков
const indexes = Object.fromEntries(
  LANGS.map((lang) => [
    `data/search-index-${lang}.json`,
    published.map((a) => ({ slug: a.slug, text: stripMd(a.body[lang]) }))
  ])
);

// «Читать также»: исходящие и входящие ссылки, добор — соседями по разделу
const related = {};
for (const article of published) {
  const out = [...article.links].filter((s) => s !== article.slug && published.some((a) => a.slug === s));
  const inc = published.filter((a) => a.links.has(article.slug)).map((a) => a.slug);
  const list = [...new Set([...out, ...inc])];
  for (const neighbour of bySection(article.section)) {
    if (list.length >= 4) break;
    if (neighbour.slug !== article.slug && !neighbour.draft && !list.includes(neighbour.slug)) list.push(neighbour.slug);
  }
  related[article.slug] = list.slice(0, 4);
}

// ссылки из базы данных на статьи вики: slug → адрес страницы
const wikiLinks = Object.fromEntries(published.map((a) => [a.slug, `wiki/${a.slug}/`]));

// страницы статей
const template = readFileSync(TEMPLATE, "utf8");
const pagePath = (slug) => `wiki/${slug}/index.html`;
function renderPage(article) {
  const section = sections.find((s) => s.id === article.section);
  const title = article.title.ru;
  const desc = article.desc.ru || `${title} — вики WWN.`;
  const canon = `${SITE}/wiki/${article.slug}/`;
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: title,
        description: desc,
        inLanguage: "ru",
        ...(article.updated ? { dateModified: article.updated } : {}),
        mainEntityOfPage: canon,
        isPartOf: { "@type": "WebSite", name: "WWN", url: `${SITE}/` }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Вики WWN", item: `${SITE}/wiki/` },
          { "@type": "ListItem", position: 2, name: section.title.ru, item: `${SITE}/wiki/#wiki-cat-${section.id}` },
          { "@type": "ListItem", position: 3, name: title }
        ]
      }
    ]
  }).replace(/</g, "\\u003c");
  return template
    .replaceAll("@@BASE@@", "../../../")
    .replaceAll("@@TITLE@@", escapeHtml(title))
    .replaceAll("@@DESC@@", escapeHtml(desc))
    .replaceAll("@@CANON@@", escapeHtml(canon))
    .replaceAll("@@ROBOTS@@", article.draft ? `  <meta name="robots" content="noindex">\n` : "")
    .replaceAll("@@JSONLD@@", `  <script type="application/ld+json">${jsonld}</script>\n`);
}

const pages = new Map(articles.map((a) => [pagePath(a.slug), renderPage(a)]));

// sitemap: главная, хаб вики, база, опубликованные статьи
const latest = published.reduce((max, a) => (a.updated > max ? a.updated : max), "");
const sitemapPage = (loc, lastmod, priority) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="ru" href="${escapeXml(loc)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(loc)}?lang=en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>
    <priority>${priority}</priority>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapPage(`${SITE}/`, latest || "", "1.0")}
${sitemapPage(`${SITE}/wiki/`, latest || "", "0.9")}
${sitemapPage(`${SITE}/database/`, latest || "", "0.8")}
${published.map((a) => sitemapPage(`${SITE}/wiki/${a.slug}/`, a.updated || latest || "", "0.6")).join("\n")}
</urlset>
`;

/* --------------------------------------------------------------- проверки -- */

const outputs = new Map([
  ["data/wiki-nav.json", `${JSON.stringify(nav, null, 2)}\n`],
  ...Object.entries(indexes).map(([file, items]) => [file, `${JSON.stringify(items, null, 2)}\n`]),
  ["data/wiki-related.json", `${JSON.stringify(related, null, 2)}\n`],
  ["data/wiki-links.json", `${JSON.stringify(wikiLinks, null, 2)}\n`],
  ["sitemap.xml", sitemap],
  ...pages
]);

// устаревшие страницы-статьи, которых больше нет в контенте
const stale = [];
if (existsSync("wiki")) {
  for (const section of readdirSync("wiki", { withFileTypes: true })) {
    if (!section.isDirectory()) continue;
    for (const page of readdirSync(join("wiki", section.name), { withFileTypes: true })) {
      if (!page.isDirectory()) continue;
      const path = `wiki/${section.name}/${page.name}/index.html`;
      if (!pages.has(path)) stale.push(path);
    }
  }
}

if (CHECK) {
  for (const [file, content] of outputs) {
    if (!existsSync(file)) error(`нет файла ${file} — запусти node tools/build-wiki.mjs`);
    else if (readFileSync(file, "utf8") !== content) error(`файл ${file} устарел — запусти node tools/build-wiki.mjs`);
  }
  for (const file of stale) error(`лишняя страница ${file} — запусти node tools/build-wiki.mjs`);
} else {
  for (const [file, content] of outputs) {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content, "utf8");
  }
  for (const file of stale) {
    rmSync(join(file, ".."), { recursive: true, force: true });
    console.log(`удалена устаревшая страница: ${file}`);
  }
  for (const section of readdirSync("wiki", { withFileTypes: true })) {
    if (!section.isDirectory()) continue;
    const dir = join("wiki", section.name);
    if (!readdirSync(dir).length) rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ отчёт -- */

console.log(`разделы: ${nav.categories.length} из ${sections.length} (без пустых)`);
console.log(`статьи: ${articles.length}, опубликовано: ${published.length}, скрыто черновиков: ${articles.length - published.length}`);
console.log(`страницы статей: ${pages.size}, поисковых записей: ${published.length}×${LANGS.length}`);

if (warnings.length) {
  console.log(`\nпредупреждения (${warnings.length}):`);
  for (const message of warnings) console.log(`  • ${message}`);
}
if (errors.length) {
  console.log(`\nошибки (${errors.length}):`);
  for (const message of errors) console.log(`  ✗ ${message}`);
  process.exit(1);
}
if (!warnings.length) console.log("проверки пройдены ✓");
