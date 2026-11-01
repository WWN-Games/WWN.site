import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type {
  Article,
  ArticleFile,
  ArticleSaveInput,
  ArticleSummary,
  Lang,
} from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { HttpError, atomicWrite, fileExists, isRealDate, readText, todayIso, toPosix } from "./http.ts";
import { readSections } from "./data.ts";
import { isSlug, slugify } from "./strings.ts";
import { runValidation } from "./validation.ts";

const WIKI_ROOT = path.join(SITE_ROOT, "src/content/wiki");
const LANGS: Lang[] = ["ru", "en"];
const KNOWN_KEYS = new Set(["title", "desc", "order", "updated", "draft"]);

interface ParsedFrontMatter {
  title: string;
  desc: string;
  order: number;
  updated: string;
  draft: boolean;
  extra: Record<string, unknown>;
  body: string;
}

interface ParsedFile extends ParsedFrontMatter {
  file: string;
  exists: boolean;
}

function articlePath(lang: Lang, slug: string): string {
  const target = path.resolve(WIKI_ROOT, lang, `${slug}.md`);
  if (!target.startsWith(`${path.resolve(WIKI_ROOT, lang)}${path.sep}`)) {
    throw new HttpError(400, "Некорректный путь статьи");
  }
  return target;
}

function parseArticle(raw: string, file: string): ParsedFrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!match) {
    throw new HttpError(500, `Нет front matter: ${file}`);
  }

  let data: unknown;
  try {
    data = parseYaml(match[1] ?? "");
  } catch (error) {
    throw new HttpError(500, `Ошибка YAML во front matter: ${file}`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError(500, `Front matter должен быть объектом: ${file}`);
  }

  const front = data as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(front)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = value;
  }

  if (typeof front.title !== "string" || front.title.trim() === "") {
    throw new HttpError(500, `Поле title отсутствует или пустое: ${file}`);
  }
  if (typeof front.desc !== "string" || front.desc.trim() === "") {
    throw new HttpError(500, `Поле desc отсутствует или пустое: ${file}`);
  }
  if (typeof front.order !== "number" || !Number.isInteger(front.order) || front.order <= 0) {
    throw new HttpError(500, `Поле order должно быть целым положительным числом: ${file}`);
  }
  const updated =
    front.updated instanceof Date
      ? front.updated.toISOString().slice(0, 10)
      : typeof front.updated === "string"
        ? front.updated
        : "";
  if (!isRealDate(updated)) {
    throw new HttpError(500, `Поле updated должно быть датой YYYY-MM-DD: ${file}`);
  }
  if (front.draft !== undefined && typeof front.draft !== "boolean") {
    throw new HttpError(500, `Поле draft должно быть true или false: ${file}`);
  }

  return {
    title: front.title,
    desc: front.desc,
    order: front.order,
    updated,
    draft: front.draft === true,
    extra,
    body: raw.slice(match[0].length).replace(/^\r?\n+/, ""),
  };
}

function serializeArticle(file: ParsedFile): string {
  const lines = [
    "---",
    `title: ${JSON.stringify(file.title)}`,
    `desc: ${JSON.stringify(file.desc)}`,
    `order: ${file.order}`,
    `updated: ${file.updated}`,
  ];
  if (file.draft) lines.push("draft: true");
  if (Object.keys(file.extra).length > 0) {
    lines.push(stringifyYaml(file.extra).trimEnd());
  }
  lines.push("---", "", file.body.trimEnd(), "");
  return lines.join("\n");
}

async function readOne(lang: Lang, slug: string): Promise<ParsedFile | null> {
  const file = articlePath(lang, slug);
  if (!(await fileExists(file))) return null;
  const raw = await readText(file);
  const parsed = parseArticle(raw, toPosix(path.relative(SITE_ROOT, file)));
  return {
    ...parsed,
    file: toPosix(path.relative(SITE_ROOT, file)),
    exists: true,
  };
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...(await walk(full, rel)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      result.push(rel.slice(0, -3));
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export async function listArticles(): Promise<ArticleSummary[]> {
  const sections = await readSections();
  const sectionOrder = new Map(sections.map((section) => [section.id, section.order]));
  const slugs = new Set<string>();
  for (const lang of LANGS) {
    for (const slug of await walk(path.join(WIKI_ROOT, lang))) slugs.add(slug);
  }

  const summaries: ArticleSummary[] = [];
  for (const slug of slugs) {
    const section = slug.split("/")[0] ?? "";
    let ru: ParsedFile | null = null;
    let en: ParsedFile | null = null;
    let error: string | undefined;
    try {
      [ru, en] = await Promise.all([readOne("ru", slug), readOne("en", slug)]);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const base = ru ?? en;
    let mtime = 0;
    for (const file of [ru, en]) {
      if (!file) continue;
      try {
        const stat = await fs.stat(path.join(SITE_ROOT, file.file));
        mtime = Math.max(mtime, stat.mtimeMs);
      } catch {
        // файл исчез между чтениями — не критично для списка
      }
    }
    summaries.push({
      slug,
      section,
      title: { ru: ru?.title ?? "", en: en?.title ?? "" },
      desc: { ru: ru?.desc ?? "", en: en?.desc ?? "" },
      order: base?.order ?? 0,
      updated: base?.updated ?? "",
      draft: base?.draft ?? false,
      hasRu: ru !== null,
      hasEn: en !== null,
      orderMismatch: ru !== null && en !== null && ru.order !== en.order,
      draftMismatch: ru !== null && en !== null && ru.draft !== en.draft,
      mtime,
      error,
    });
  }

  return summaries.sort((a, b) => {
    const sectionA = sectionOrder.get(a.section) ?? 999;
    const sectionB = sectionOrder.get(b.section) ?? 999;
    return (
      sectionA - sectionB ||
      a.section.localeCompare(b.section) ||
      a.order - b.order ||
      a.title.ru.localeCompare(b.title.ru, "ru")
    );
  });
}

export async function readArticle(slug: string): Promise<Article> {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !isSlug(parts[1] ?? "")) {
    throw new HttpError(400, "Некорректный slug статьи");
  }
  const [section, name] = parts as [string, string];
  const [ru, en] = await Promise.all([readOne("ru", slug), readOne("en", slug)]);
  if (!ru && !en) throw new HttpError(404, `Статья «${slug}» не найдена`);

  const base = ru ?? en;
  const empty = (lang: Lang): ArticleFile => ({
    title: "",
    desc: "",
    body: "",
    file: toPosix(path.relative(SITE_ROOT, articlePath(lang, slug))),
    exists: false,
  });
  const toFile = (file: ParsedFile | null, lang: Lang): ArticleFile =>
    file
      ? {
          title: file.title,
          desc: file.desc,
          body: file.body,
          file: file.file,
          exists: true,
          extra: file.extra,
        }
      : empty(lang);

  return {
    slug,
    section,
    order: base?.order ?? 1,
    updated: base?.updated ?? todayIso(),
    draft: base?.draft ?? true,
    orderMismatch: ru !== null && en !== null && ru.order !== en.order,
    draftMismatch: ru !== null && en !== null && ru.draft !== en.draft,
    ru: toFile(ru, "ru"),
    en: toFile(en, "en"),
  };
}

export async function articleDefaults(section: string): Promise<{ order: number; section: string }> {
  const articles = await listArticles();
  const inSection = articles.filter((article) => article.section === section);
  const max = inSection.reduce((value, article) => Math.max(value, article.order), 0);
  return { order: max + 1, section };
}

export async function saveArticle(input: ArticleSaveInput): Promise<{
  article: Article;
  validation: ReturnType<typeof runValidation>;
}> {
  if (input === null || typeof input !== "object") throw new HttpError(400, "Нет данных статьи");
  const sections = await readSections();
  if (!sections.some((section) => section.id === input.section)) {
    throw new HttpError(400, `Неизвестный раздел «${input.section}»`);
  }

  const parts = input.slug.split("/");
  if (parts.length !== 2 || parts[0] !== input.section || !isSlug(parts[1] ?? "")) {
    throw new HttpError(400, "Slug должен быть в формате «раздел/статья» и содержать латиницу");
  }
  if (!Number.isInteger(input.order) || input.order <= 0) {
    throw new HttpError(400, "Порядок должен быть целым числом больше нуля");
  }
  if (!isRealDate(input.updated)) throw new HttpError(400, "Дата должна быть в формате YYYY-MM-DD");
  if (typeof input.draft !== "boolean") throw new HttpError(400, "draft должен быть boolean");

  for (const lang of LANGS) {
    const file = input[lang];
    if (!file || typeof file.title !== "string" || file.title.trim() === "") {
      throw new HttpError(400, `Заголовок ${lang.toUpperCase()} не заполнен`);
    }
    if (typeof file.desc !== "string" || file.desc.trim() === "") {
      throw new HttpError(400, `Описание ${lang.toUpperCase()} не заполнено`);
    }
    if (typeof file.body !== "string") {
      throw new HttpError(400, `Текст ${lang.toUpperCase()} должен быть строкой`);
    }
  }

  const all = await listArticles();
  const duplicateOrder = all.find(
    (article) =>
      article.section === input.section &&
      article.slug !== input.originalSlug &&
      article.slug !== input.slug &&
      article.order === input.order,
  );
  if (duplicateOrder) {
    throw new HttpError(
      409,
      `Порядок ${input.order} уже занят статьёй «${duplicateOrder.slug}»`,
    );
  }

  const oldPaths = input.originalSlug
    ? LANGS.map((lang) => articlePath(lang, input.originalSlug as string))
    : [];
  const newPaths = LANGS.map((lang) => articlePath(lang, input.slug));
  const renaming = Boolean(input.originalSlug && input.originalSlug !== input.slug);
  if (renaming) {
    for (const target of newPaths) {
      if (await fileExists(target)) {
        throw new HttpError(409, `Файл уже существует: ${toPosix(path.relative(SITE_ROOT, target))}`);
      }
    }
  } else if (!input.originalSlug) {
    for (const target of newPaths) {
      if (await fileExists(target)) {
        throw new HttpError(409, `Статья уже существует: ${toPosix(path.relative(SITE_ROOT, target))}`);
      }
    }
  }

  const oldFiles = input.originalSlug
    ? await Promise.all(LANGS.map((lang) => readOne(lang, input.originalSlug as string)))
    : [null, null];

  for (const [index, lang] of LANGS.entries()) {
    const old = oldFiles[index];
    const payload: ParsedFile = {
      title: input[lang].title.trim(),
      desc: input[lang].desc.trim(),
      order: input.order,
      updated: input.updated,
      draft: input.draft,
      extra: old?.extra ?? {},
      body: input[lang].body,
      file: toPosix(path.relative(SITE_ROOT, newPaths[index] as string)),
      exists: true,
    };
    await atomicWrite(newPaths[index] as string, serializeArticle(payload));
  }

  if (renaming) {
    for (const old of oldPaths) {
      await fs.rm(old, { force: true });
    }
  }

  return {
    article: await readArticle(input.slug),
    validation: runValidation(),
  };
}

export async function deleteArticle(slug: string): Promise<ReturnType<typeof runValidation>> {
  const paths = LANGS.map((lang) => articlePath(lang, slug));
  const existed = await Promise.all(paths.map((file) => fileExists(file)));
  if (!existed.some(Boolean)) throw new HttpError(404, `Статья «${slug}» не найдена`);
  for (const file of paths) await fs.rm(file, { force: true });
  return runValidation();
}

export async function duplicateArticle(slug: string): Promise<{
  article: Article;
  validation: ReturnType<typeof runValidation>;
}> {
  const source = await readArticle(slug);
  const section = source.section;
  let candidate = `${slug}-copy`;
  let counter = 2;
  while (
    (await fileExists(articlePath("ru", candidate))) ||
    (await fileExists(articlePath("en", candidate)))
  ) {
    candidate = `${slug}-copy-${counter}`;
    counter += 1;
  }
  const order = await articleDefaults(section);
  return saveArticle({
    section,
    slug: candidate,
    order: order.order,
    updated: todayIso(),
    draft: true,
    ru: {
      title: `${source.ru.title || source.en.title} (копия)`.trim(),
      desc: source.ru.desc || source.en.desc,
      body: source.ru.body,
    },
    en: {
      title: `${source.en.title || source.ru.title} (copy)`.trim(),
      desc: source.en.desc || source.ru.desc,
      body: source.en.body,
    },
  });
}

export function suggestSlug(title: string): string {
  return slugify(title) || "article";
}
