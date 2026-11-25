/* ============================================================================
   WWN — импорт данных мода: парсер INI с наследованием.
   Поддерживает секции, @global, copyFrom, @copyFromSection и простые ${...}.
   ============================================================================ */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface IniSection {
  name: string;
  entries: Array<[string, string]>;
}

export interface ParsedIni {
  file: string;
  sections: Map<string, IniSection>;
  globals: Map<string, string>;
}

export interface MergedIni {
  file: string;
  sections: Map<string, IniSection>;
  globals: Map<string, string>;
  templates: string[];
  unresolved: string[];
}

const sectionRe = /^\s*\[([^\]]+)\]\s*$/;
const keyRe = /^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/;

export function parseIni(file: string): ParsedIni {
  const text = readFileSync(file, "utf8");
  const sections = new Map<string, IniSection>();
  const globals = new Map<string, string>();
  let current: IniSection | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const sectionMatch = sectionRe.exec(line);
    if (sectionMatch) {
      const name = sectionMatch[1]!.trim();
      const key = name.toLowerCase();
      let section = sections.get(key);
      if (!section) {
        section = { name, entries: [] };
        sections.set(key, section);
      }
      current = section;
      continue;
    }

    const keyMatch = keyRe.exec(line);
    if (!keyMatch) continue;
    const key = keyMatch[1]!.trim();
    const value = keyMatch[2]!.trim();

    if (key.toLowerCase().startsWith("@global ")) {
      globals.set(key.slice(8).trim().toLowerCase(), value);
      continue;
    }

    if (!current) {
      const root = sections.get("__root__") ?? { name: "__root__", entries: [] };
      root.entries.push([key.toLowerCase(), value]);
      sections.set("__root__", root);
      continue;
    }

    current.entries.push([key.toLowerCase(), value]);
  }

  return { file, sections, globals };
}

function addSection(target: Map<string, IniSection>, section: IniSection): void {
  const key = section.name.toLowerCase();
  const existing = target.get(key);
  if (!existing) {
    target.set(key, { name: section.name, entries: [...section.entries] });
    return;
  }
  existing.entries.push(...section.entries);
}

function copyFromRefs(parsed: ParsedIni): string[] {
  const core = parsed.sections.get("core");
  if (!core) return [];
  const refs: string[] = [];
  for (const [key, value] of core.entries) {
    if (key !== "copyfrom") continue;
    for (const raw of value.split(",")) {
      const ref = raw.trim();
      if (!ref || ref.includes("${")) continue;
      refs.push(ref);
    }
  }
  return refs;
}

function resolveRef(file: string, root: string, ref: string): string | null {
  let clean = ref
    .replace(/^ROOT:/i, "")
    .replace(/\\/g, "/")
    .trim();
  if (!clean) return null;
  if (clean.startsWith("/")) clean = clean.slice(1);
  const base = /^ROOT:/i.test(ref) ? root : path.dirname(file);
  const target = path.resolve(base, clean);
  return existsSync(target) ? target : null;
}

const mergeCache = new Map<string, MergedIni>();

export function loadMerged(file: string, root: string, stack: string[] = []): MergedIni {
  const absolute = path.resolve(file);
  const cached = mergeCache.get(absolute);
  if (cached) return cached;

  if (stack.includes(absolute)) {
    return {
      file: absolute,
      sections: new Map(),
      globals: new Map(),
      templates: [],
      unresolved: [`цикл copyFrom: ${[...stack, absolute].join(" → ")}`],
    };
  }

  const parsed = parseIni(absolute);
  const merged: MergedIni = {
    file: absolute,
    sections: new Map(),
    globals: new Map(),
    templates: [],
    unresolved: [],
  };

  for (const ref of copyFromRefs(parsed)) {
    const target = resolveRef(absolute, root, ref);
    if (!target) {
      merged.unresolved.push(`не найден copyFrom: ${ref}`);
      continue;
    }
    const child = loadMerged(target, root, [...stack, absolute]);
    merged.templates.push(...child.templates, target);
    merged.unresolved.push(...child.unresolved);
    for (const section of child.sections.values()) addSection(merged.sections, section);
    for (const [key, value] of child.globals) merged.globals.set(key, value);
  }

  for (const section of parsed.sections.values()) addSection(merged.sections, section);
  for (const [key, value] of parsed.globals) merged.globals.set(key, value);

  mergeCache.set(absolute, merged);
  return merged;
}

export function clearMergeCache(): void {
  mergeCache.clear();
}

export function section(merged: MergedIni, name: string): IniSection | undefined {
  return merged.sections.get(name.toLowerCase());
}

export function values(merged: MergedIni, sectionName: string, key: string): string[] {
  const target = section(merged, sectionName);
  if (!target) return [];
  const lower = key.toLowerCase();
  return target.entries.filter(([k]) => k === lower).map(([, v]) => v);
}

export function last(merged: MergedIni, sectionName: string, key: string): string | undefined {
  const all = values(merged, sectionName, key);
  return all.length > 0 ? all[all.length - 1] : undefined;
}

export function has(merged: MergedIni, sectionName: string, key: string): boolean {
  return values(merged, sectionName, key).length > 0;
}

function globalValue(merged: MergedIni, key: string): string | undefined {
  return merged.globals.get(key.toLowerCase());
}

/** Подставляет простые ${key} и ${section.key}; сложные выражения оставляет как есть. */
export function resolveValue(merged: MergedIni, raw: string): string {
  let value = raw;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = value.replace(/\$\{(-?)([a-zA-Z0-9_.]+)\}/g, (match, sign, key) => {
      if (key.includes("/") || key.includes("*") || key.includes("+")) return match;
      const parts = key.split(".");
      let replacement: string | undefined;
      if (parts.length === 1) replacement = globalValue(merged, key);
      else {
        const sec = parts.slice(0, -1).join(".");
        const field = parts[parts.length - 1]!;
        replacement = last(merged, sec, field);
      }
      if (replacement === undefined) return match;
      return sign === "-" ? `-${replacement}` : replacement;
    });
    if (next === value) break;
    value = next;
  }
  return value;
}

export function resolvedLast(
  merged: MergedIni,
  sectionName: string,
  key: string,
): string | undefined {
  const value = last(merged, sectionName, key);
  return value === undefined ? undefined : resolveValue(merged, value);
}

export function resolvedValues(merged: MergedIni, sectionName: string, key: string): string[] {
  return values(merged, sectionName, key).map((value) => resolveValue(merged, value));
}

export function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const clean = value.trim().replace(",", ".");
  if (clean === "" || clean.includes("${") || /[a-zA-Zа-яА-Я]/.test(clean.replace(/^if.*$/i, ""))) {
    return undefined;
  }
  const match = /^-?\d+(?:\.\d+)?/.exec(clean);
  if (!match) return undefined;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : undefined;
}

export function parseSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const clean = value.trim();
  const withSuffix = /^(-?\d+(?:\.\d+)?)s$/i.exec(clean);
  if (withSuffix) return Number(withSuffix[1]);
  return parseNumber(clean);
}

export function parseTicks(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const clean = value.trim();
  const withSuffix = /^(-?\d+(?:\.\d+)?)s$/i.exec(clean);
  if (withSuffix) return Number(withSuffix[1]);
  const number = parseNumber(clean);
  if (number === undefined) return undefined;
  return number / 60;
}

export function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const clean = value.trim().toLowerCase();
  if (clean === "true" || clean === "1" || clean === "yes") return true;
  if (clean === "false" || clean === "0" || clean === "no" || clean === "none") return false;
  if (clean.startsWith("if ")) return true;
  return fallback;
}

export function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function sectionNames(merged: MergedIni): string[] {
  return [...merged.sections.keys()];
}
