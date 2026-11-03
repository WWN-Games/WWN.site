/* ============================================================================
   WWN — доступ к контенту вики на сборке.
   Навигация, «Читать также», пейджер и цифры — поверх Content Collections.
   ============================================================================ */

import { type CollectionEntry, getCollection } from "astro:content";

import { type Lang, localeHref } from "./site";
import { collectStats } from "./stats";

export type WikiEntry = CollectionEntry<"wiki">;
type PublishedWikiEntry = WikiEntry & { data: { draft: false } };

/** Черновики видны только в dev; в продакшене они не собираются вовсе. */
const includeDrafts = import.meta.env.DEV;

export function entryLang(entry: WikiEntry): Lang {
  return entry.id.startsWith("en/") ? "en" : "ru";
}

/** «lore/history» из id «ru/lore/history». */
export function entrySlug(entry: WikiEntry): string {
  return entry.id.replace(/^(ru|en)\//, "");
}

export function entrySection(entry: WikiEntry): string {
  return entrySlug(entry).split("/")[0] ?? "";
}

export function entryHref(entry: WikiEntry): string {
  return localeHref(entryLang(entry), `wiki/${entrySlug(entry)}/`);
}

function bySectionThenOrder(a: WikiEntry, b: WikiEntry, sectionOrder: Map<string, number>): number {
  const sectionDiff =
    (sectionOrder.get(entrySection(a)) ?? 99) - (sectionOrder.get(entrySection(b)) ?? 99);
  return sectionDiff || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);
}

/* В статической сборке одна и та же коллекция запрашивается из getStaticPaths,
   страницы и API. Кэш живёт на процесс сборки; в dev его нет, чтобы правки
   Markdown подхватывались сразу. */
const entriesCache = new Map<Lang, Promise<WikiEntry[]>>();
const publishedCache = new Map<Lang, Promise<PublishedWikiEntry[]>>();
let sectionsPromise: Promise<Awaited<ReturnType<typeof loadSections>>> | null = null;

async function loadSections() {
  const sections = await getCollection("sections");
  return sections.sort((a, b) => a.data.order - b.data.order);
}

async function getSections() {
  if (import.meta.env.DEV) return loadSections();
  sectionsPromise ??= loadSections().catch((error: unknown) => {
    sectionsPromise = null;
    throw error;
  });
  return sectionsPromise;
}

async function loadEntries(lang: Lang): Promise<WikiEntry[]> {
  const [entries, sections] = await Promise.all([getCollection("wiki"), getSections()]);
  const sectionOrder = new Map(sections.map((section) => [section.id, section.data.order]));
  return entries
    .filter((entry) => entryLang(entry) === lang)
    .filter((entry) => includeDrafts || !entry.data.draft)
    .sort((a, b) => bySectionThenOrder(a, b, sectionOrder));
}

/** Все статьи языка (в dev — включая черновики), в порядке разделов и order. */
export async function getEntries(lang: Lang): Promise<WikiEntry[]> {
  if (import.meta.env.DEV) return loadEntries(lang);
  let promise = entriesCache.get(lang);
  if (!promise) {
    promise = loadEntries(lang).catch((error: unknown) => {
      entriesCache.delete(lang);
      throw error;
    });
    entriesCache.set(lang, promise);
  }
  return promise;
}

export async function getPublished(lang: Lang): Promise<PublishedWikiEntry[]> {
  if (import.meta.env.DEV) {
    const entries = await getEntries(lang);
    return entries.filter((entry): entry is PublishedWikiEntry => !entry.data.draft);
  }
  let promise = publishedCache.get(lang);
  if (!promise) {
    promise = getEntries(lang)
      .then((entries) => entries.filter((entry): entry is PublishedWikiEntry => !entry.data.draft))
      .catch((error: unknown) => {
        publishedCache.delete(lang);
        throw error;
      });
    publishedCache.set(lang, promise);
  }
  return promise;
}

/** Разделы с опубликованными статьями (для хаба и сайдбара). */
export async function getNav(lang: Lang) {
  const [entries, sections] = await Promise.all([getPublished(lang), getSections()]);
  return sections
    .map((section) => ({
      ...section.data,
      articles: entries.filter((entry) => entrySection(entry) === section.data.id),
    }))
    .filter((section) => section.articles.length > 0);
}

/** Цели внутренних .md-ссылок в теле статьи: «../lore/history.md» → «lore/history». */
function linkTargets(body: string, slug: string, lang: Lang): string[] {
  const targets = new Set<string>();
  for (const match of body.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) {
    const raw = match[1];
    if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const url = new URL(raw, `https://wwn.local/content/${lang}/${slug}.md`);
    targets.add(url.pathname.replace(`/content/${lang}/`, "").replace(/\.md$/, ""));
  }
  return [...targets];
}

/** «Читать также»: исходящие и входящие ссылки, добор — соседями по разделу. */
export async function getRelated(lang: Lang, slug: string): Promise<WikiEntry[]> {
  const published = await getPublished(lang);
  const bySlug = new Map(published.map((entry) => [entrySlug(entry), entry]));
  const current = bySlug.get(slug);
  if (!current) return [];

  const linksOf = new Map(
    published.map((entry) => [
      entrySlug(entry),
      linkTargets(entry.body ?? "", entrySlug(entry), lang),
    ]),
  );

  const outgoing = (linksOf.get(slug) ?? []).filter((target) => bySlug.has(target));
  const incoming = published
    .filter((entry) => (linksOf.get(entrySlug(entry)) ?? []).includes(slug))
    .map((entry) => entrySlug(entry));

  const result = [...new Set([...outgoing, ...incoming])].filter((target) => target !== slug);
  for (const neighbour of published.filter(
    (entry) => entrySection(entry) === entrySection(current),
  )) {
    if (result.length >= 4) break;
    const neighbourSlug = entrySlug(neighbour);
    if (neighbourSlug !== slug && !result.includes(neighbourSlug)) result.push(neighbourSlug);
  }
  return result.slice(0, 4).flatMap((target) => bySlug.get(target) ?? []);
}

/** Предыдущая/следующая опубликованная статья в общем порядке. */
export async function getPager(
  lang: Lang,
  slug: string,
): Promise<{ prev: WikiEntry | undefined; next: WikiEntry | undefined }> {
  const published = await getPublished(lang);
  const index = published.findIndex((entry) => entrySlug(entry) === slug);
  if (index === -1) return { prev: undefined, next: undefined };
  return { prev: published[index - 1], next: published[index + 1] };
}

/** Живые цифры: юниты, строения, фракции и теги считаются по данным. */
export function getStats() {
  return collectStats();
}
