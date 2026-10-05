/* ============================================================================
   WWN — валидация контента вики и данных базы.
   Запуск: node scripts/validate-content.ts (exit 1 при любой ошибке).
   Те же проверки гоняет tests/unit/content.test.ts через validateContent().
   ============================================================================ */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ZodType } from "astro/zod";

import {
  buildingSchema,
  factionSchema,
  sectionSchema,
  statsSchema,
  tagSchema,
  unitSchema,
} from "../src/lib/schemas.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_DIR = path.join(ROOT, "src", "content", "wiki");
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DIR = path.join(ROOT, "public");

const LANGS = ["ru", "en"] as const;
type Lang = (typeof LANGS)[number];

const FRONT_MATTER_KEYS = ["title", "desc", "order", "updated", "draft"] as const;
type FrontMatterKey = (typeof FRONT_MATTER_KEYS)[number];

interface FrontMatter {
  title: string;
  desc: string;
  order: number;
  updated: string;
  draft: boolean;
}

interface Article {
  file: string;
  lang: Lang;
  section: string;
  slug: string;
  dir: string;
  data: FrontMatter;
  body: string;
}

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function listFiles(dir: string, extension: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(full);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function isFrontMatterKey(key: string): key is FrontMatterKey {
  return (FRONT_MATTER_KEYS as readonly string[]).includes(key);
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Строгий разбор front matter: title/desc в кавычках, order:int, updated:YYYY-MM-DD, draft:bool. */
function parseFrontMatter(
  raw: string,
  file: string,
  errors: string[],
): { data: FrontMatter | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!match) {
    errors.push(`${file}: нет front matter (ожидается блок --- ... ---)`);
    return { data: null, body: raw };
  }
  const body = raw.slice(match[0].length);
  const values = new Map<FrontMatterKey, string>();
  const lines = (match[1] ?? "").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim() === "") return;
    const parsed = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (!parsed) {
      errors.push(`${file}: front matter, строка ${index + 2}: неверный формат «${line}»`);
      return;
    }
    const [, key, value] = parsed;
    if (key === undefined || value === undefined) return;
    if (!isFrontMatterKey(key)) {
      errors.push(`${file}: front matter: неизвестное поле «${key}»`);
      return;
    }
    if (values.has(key)) {
      errors.push(`${file}: front matter: поле «${key}» повторяется`);
      return;
    }
    values.set(key, value.trim());
  });

  const title = values.get("title");
  if (title === undefined) errors.push(`${file}: front matter: нет поля title`);
  else if (!/^".+"$/.test(title)) errors.push(`${file}: title должен быть в двойных кавычках`);

  const desc = values.get("desc");
  if (desc === undefined) errors.push(`${file}: front matter: нет поля desc`);
  else if (!/^".+"$/.test(desc)) errors.push(`${file}: desc должен быть в двойных кавычках`);

  const orderRaw = values.get("order");
  let order: number | null = null;
  if (orderRaw === undefined) errors.push(`${file}: front matter: нет поля order`);
  else if (!/^\d+$/.test(orderRaw)) errors.push(`${file}: order должен быть целым числом`);
  else {
    order = Number(orderRaw);
    if (order <= 0) errors.push(`${file}: order должен быть больше нуля`);
  }

  const updated = values.get("updated");
  if (updated === undefined) errors.push(`${file}: front matter: нет поля updated`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(updated))
    errors.push(`${file}: updated должен быть в формате YYYY-MM-DD`);
  else if (!isRealDate(updated)) errors.push(`${file}: updated — несуществующая дата «${updated}»`);

  const draftRaw = values.get("draft");
  let draft = false;
  if (draftRaw !== undefined) {
    if (draftRaw === "true") draft = true;
    else if (draftRaw === "false") draft = false;
    else errors.push(`${file}: draft должен быть true или false`);
  }

  if (title === undefined || desc === undefined || order === null || updated === undefined) {
    return { data: null, body };
  }
  return {
    data: { title: title.slice(1, -1), desc: desc.slice(1, -1), order, updated, draft },
    body,
  };
}

/** Убирает блоки кода и инлайн-код: там ссылки и картинки не рендерятся. */
function stripCode(body: string): string {
  return body
    .replace(/^```[\s\S]*?^```[ \t]*$/gm, "")
    .replace(/^~~~[\s\S]*?^~~~[ \t]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

/** «../lore/history.md» + раздел → «lore/history»; null — если ссылка не внутренняя. */
function resolveMarkdownLink(raw: string, lang: Lang, dir: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("/")) return null;
  const url = new URL(raw, `https://wwn.local/content/${lang}/${dir}/article.md`);
  const prefix = `/content/${lang}/`;
  if (!url.pathname.startsWith(prefix)) return null;
  return url.pathname.slice(prefix.length).replace(/\.md$/i, "");
}

function loadJson(file: string, errors: string[]): unknown {
  const full = path.join(DATA_DIR, file);
  try {
    return JSON.parse(readFileSync(full, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`src/data/${file}: не удалось прочитать JSON (${message})`);
    return null;
  }
}

function arrayOf(value: unknown, key: string, file: string, errors: string[]): unknown[] {
  if (value === null || typeof value !== "object" || !(key in value)) {
    errors.push(`src/data/${file}: нет массива «${key}»`);
    return [];
  }
  const items = (value as Record<string, unknown>)[key];
  if (!Array.isArray(items)) {
    errors.push(`src/data/${file}: «${key}» — не массив`);
    return [];
  }
  return items;
}

function parseItems<T>(file: string, items: unknown[], schema: ZodType<T>, errors: string[]): T[] {
  const result: T[] = [];
  items.forEach((item, index) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const where = issue.path.length > 0 ? `.${issue.path.map(String).join(".")}` : "";
        errors.push(`src/data/${file}[${index}]${where}: ${issue.message}`);
      }
      return;
    }
    result.push(parsed.data);
  });
  return result;
}

function uniqueIds<T extends { id: string }>(
  file: string,
  items: T[],
  errors: string[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) errors.push(`src/data/${file}: дублирующийся id «${item.id}»`);
    else map.set(item.id, item);
  }
  return map;
}

/** Все проверки контента и данных; пустой массив — всё в порядке. */
export function validateContent(): string[] {
  const errors: string[] = [];

  // --- разделы вики -----------------------------------------------------------
  const sections = parseItems(
    "sections.json",
    arrayOf(loadJson("sections.json", errors), "sections", "sections.json", errors),
    sectionSchema,
    errors,
  );
  const sectionIds = new Set(uniqueIds("sections.json", sections, errors).keys());
  const sectionOrders = new Map<number, string>();
  for (const section of sections) {
    const previous = sectionOrders.get(section.order);
    if (previous !== undefined && previous !== section.id) {
      errors.push(
        `src/data/sections.json: order ${section.order} повторяется («${previous}», «${section.id}»)`,
      );
    } else {
      sectionOrders.set(section.order, section.id);
    }
  }

  // --- статьи вики ------------------------------------------------------------
  const articles: Article[] = [];
  const slugsByLang = new Map<Lang, Set<string>>(LANGS.map((lang) => [lang, new Set<string>()]));

  for (const file of listFiles(WIKI_DIR, ".md")) {
    const name = relative(file);
    const parts = name.slice("src/content/wiki/".length).split("/");
    const lang = parts[0];
    if (lang !== "ru" && lang !== "en") {
      errors.push(`${name}: статья должна лежать в папке ru или en`);
      continue;
    }
    if (parts.length < 3) {
      errors.push(`${name}: статья должна лежать в разделе (ru/<раздел>/<статья>.md)`);
      continue;
    }
    const section = parts[1];
    if (section === undefined) continue;
    if (!sectionIds.has(section)) {
      errors.push(`${name}: раздел «${section}» не описан в src/data/sections.json`);
      continue;
    }
    const slug = parts.slice(1).join("/").replace(/\.md$/i, "");
    const raw = readFileSync(file, "utf8");
    const { data, body } = parseFrontMatter(raw, name, errors);
    if (!data) continue;
    const dir = slug.split("/").slice(0, -1).join("/");
    articles.push({ file: name, lang, section, slug, dir, data, body });
    slugsByLang.get(lang)?.add(slug);
  }

  // паритет языков
  const bySlug = new Map<string, Map<Lang, Article>>();
  for (const article of articles) {
    let langs = bySlug.get(article.slug);
    if (!langs) {
      langs = new Map<Lang, Article>();
      bySlug.set(article.slug, langs);
    }
    langs.set(article.lang, article);
  }
  for (const [slug, langs] of [...bySlug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const lang of LANGS) {
      if (!langs.has(lang))
        errors.push(`вики: у статьи «${slug}» нет версии ${lang.toUpperCase()}`);
    }
    const ru = langs.get("ru");
    const en = langs.get("en");
    if (ru && en) {
      if (ru.data.order !== en.data.order) {
        errors.push(
          `вики: у статьи «${slug}» order не совпадает (ru: ${ru.data.order}, en: ${en.data.order})`,
        );
      }
      if (ru.data.draft !== en.data.draft) {
        errors.push(
          `вики: у статьи «${slug}» draft не совпадает (ru: ${ru.data.draft}, en: ${en.data.draft})`,
        );
      }
    }
  }

  // order уникален внутри раздела (для каждого языка)
  const orderKeys = new Map<string, string>();
  for (const article of articles) {
    const key = `${article.lang}/${article.section}/${article.data.order}`;
    const previous = orderKeys.get(key);
    if (previous !== undefined && previous !== article.slug) {
      errors.push(
        `вики: order ${article.data.order} повторяется в разделе «${article.section}» (${article.lang}): «${previous}», «${article.slug}»`,
      );
    } else {
      orderKeys.set(key, article.slug);
    }
  }

  // ссылки, картинки и сырые ассеты в телах статей
  for (const article of articles) {
    const body = stripCode(article.body);
    for (const match of body.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/gi)) {
      const raw = match[1];
      if (raw === undefined) continue;
      const target = resolveMarkdownLink(raw, article.lang, article.dir);
      if (target === null || !slugsByLang.get(article.lang)?.has(target)) {
        errors.push(`${article.file}: ссылка «${raw}» ведёт в несуществующую статью`);
      }
    }
    for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const raw = match[1];
      if (raw === undefined) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("/")) continue;
      const target = path.resolve(path.dirname(path.join(ROOT, article.file)), raw);
      if (!existsSync(target)) errors.push(`${article.file}: картинка «${raw}» не найдена`);
    }
    for (const match of article.body.matchAll(/(?:src|href)="(\.\.\/assets\/[^"]+)"/g)) {
      const raw = match[1];
      if (raw === undefined) continue;
      const target = path.resolve(PUBLIC_DIR, raw.replace(/^\.\.\/assets\//, ""));
      if (!target.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        errors.push(`${article.file}: ассет «${raw}» выходит за пределы public/`);
      } else if (!existsSync(target)) {
        errors.push(`${article.file}: ассет «${raw}» не найден (ожидается ${relative(target)})`);
      }
    }
  }

  // --- данные базы ------------------------------------------------------------
  const factions = parseItems(
    "factions.json",
    arrayOf(loadJson("factions.json", errors), "factions", "factions.json", errors),
    factionSchema,
    errors,
  );
  const factionIds = new Set(uniqueIds("factions.json", factions, errors).keys());

  const tags = parseItems(
    "tags.json",
    arrayOf(loadJson("tags.json", errors), "tags", "tags.json", errors),
    tagSchema,
    errors,
  );
  const tagIds = new Set(uniqueIds("tags.json", tags, errors).keys());

  const units = parseItems(
    "units.json",
    arrayOf(loadJson("units.json", errors), "units", "units.json", errors),
    unitSchema,
    errors,
  );
  const buildings = parseItems(
    "buildings.json",
    arrayOf(loadJson("buildings.json", errors), "buildings", "buildings.json", errors),
    buildingSchema,
    errors,
  );

  uniqueIds("units.json", units, errors);
  uniqueIds("buildings.json", buildings, errors);
  const cardIds = new Map<string, string>();
  for (const [file, cards] of [
    ["units.json", units],
    ["buildings.json", buildings],
  ] as const) {
    for (const card of cards) {
      const previous = cardIds.get(card.id);
      if (previous !== undefined && previous !== file) {
        errors.push(`src/data/${file}: id «${card.id}» уже используется в ${previous}`);
      } else {
        cardIds.set(card.id, file);
      }
      if (!factionIds.has(card.faction)) {
        errors.push(`src/data/${file}: ${card.id}: неизвестная фракция «${card.faction}»`);
      }
      for (const tag of card.tags) {
        if (!tagIds.has(tag))
          errors.push(`src/data/${file}: ${card.id}: незарегистрированный тег «${tag}»`);
      }
      if (card.image === "") continue;
      const image = card.image ?? `img/database/${card.id}.avif`;
      const target = path.resolve(PUBLIC_DIR, image);
      if (!target.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        errors.push(`src/data/${file}: ${card.id}: картинка «${image}» выходит за пределы public/`);
      } else if (!existsSync(target)) {
        errors.push(`src/data/${file}: ${card.id}: нет картинки public/${image}`);
      }
    }
  }

  const stats = statsSchema.safeParse(loadJson("stats.json", errors));
  if (!stats.success) {
    for (const issue of stats.error.issues) {
      errors.push(`src/data/stats.json: ${issue.message}`);
    }
  }

  return errors;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const errors = validateContent();
  if (errors.length > 0) {
    console.error(`validate-content: найдено ошибок — ${errors.length}`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }
  console.log("validate-content: OK");
}
