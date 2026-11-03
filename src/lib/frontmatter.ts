/* ============================================================================
   WWN — разбор и запись front matter статей.
   Один парсер для админки и scripts/validate-content.ts, чтобы сохранение
   в редакторе и `pnpm validate` не расходились.
   ============================================================================ */

import {
  type ParseOptions,
  parseDocument,
  type SchemaOptions,
  stringify as stringifyYaml,
} from "yaml";

import { type WikiFrontMatter, wikiSchema } from "./schemas.ts";

/* Те же опции, что у Astro Content Layer: иначе timestamp-подобные строки
   разбираются по-разному и админка может записать невалидный front matter. */
const PARSE_OPTIONS: ParseOptions & SchemaOptions = {
  customTags: ["timestamp"],
  merge: true,
  schema: "core",
};

export interface ParsedFrontMatter {
  data: Record<string, unknown>;
  body: string;
  unknownKeys: string[];
}

export function parseArticleFrontMatter(raw: string): ParsedFrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!match) throw new Error("Нет front matter (ожидается блок --- ... ---)");

  let parsed: unknown;
  try {
    const document = parseDocument(match[1] ?? "", PARSE_OPTIONS);
    if (document.errors.length > 0) throw document.errors[0];
    parsed = document.toJS();
  } catch (error) {
    throw new Error(
      `Ошибка YAML во front matter: ${error instanceof Error ? error.message : error}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Front matter должен быть YAML-объектом");
  }

  const data = parsed as Record<string, unknown>;
  const known = new Set(Object.keys(wikiSchema.shape));
  return {
    data,
    body: raw.slice(match[0].length),
    unknownKeys: Object.keys(data).filter((key) => !known.has(key)),
  };
}

export function serializeArticleFrontMatter(
  data: WikiFrontMatter,
  body: string,
  extra?: Record<string, unknown>,
): string {
  const frontMatter = { ...extra, ...data, draft: data.draft ?? false };
  const yaml = stringifyYaml(frontMatter, {
    customTags: ["timestamp"],
    lineWidth: 0,
  }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, "")}`;
}
