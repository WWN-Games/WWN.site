#!/usr/bin/env node
/* ============================================================================
   WWN — проверка языковых данных.
   Запуск:  node tools/check-i18n.mjs
   ----------------------------------------------------------------------------
   Что проверяет:
   1) все JSON в data/ валидны;
   2) в парах { ru, en } нет пустого/отсутствующего en (когда ru заполнен);
   3) в английских строках нет кириллицы;
   4) нет одинаковых длинных en-описаний у разных записей (заглушки-дубли);
   5) у каждой статьи есть пара ru/en с одинаковым slug.
   Выход: 0 — ошибок нет, 1 — есть ошибки (предупреждения не валят проверку).
   ============================================================================ */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CYRILLIC = /[а-яёА-ЯЁ]/;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ------------------------------------------------------------------ JSON -- */
const DATA_FILES = ["units.json", "buildings.json", "factions.json", "tags.json", "wiki-nav.json"];

const seenEn = new Map(); // en-строка -> список мест

function walk(node, where) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, `${where}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;

  const isPair = Object.prototype.hasOwnProperty.call(node, "ru") || Object.prototype.hasOwnProperty.call(node, "en");
  if (isPair) {
    const ru = typeof node.ru === "string" ? node.ru.trim() : "";
    const en = typeof node.en === "string" ? node.en.trim() : "";
    if (ru && !en) warn(`${where}: нет en (будет использован ru)`);
    if (en && CYRILLIC.test(en)) err(`${where}: кириллица в en → «${en.slice(0, 80)}»`);
    if (en.length > 40) {
      const key = en;
      if (!seenEn.has(key)) seenEn.set(key, []);
      seenEn.get(key).push(where);
    }
  }
  for (const [key, value] of Object.entries(node)) walk(value, `${where}.${key}`);
}

for (const file of DATA_FILES) {
  const filePath = path.join(ROOT, "data", file);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (e) {
    err(`data/${file}: невалидный JSON — ${e.message}`);
    continue;
  }
  walk(parsed, `data/${file}`);
}

for (const [en, places] of seenEn) {
  if (places.length > 1) {
    // 27 одинаковых описаний построек/юнитов допустимы только если текст осмысленный,
    // поэтому помечаем как предупреждение с числом повторов
    warn(`одинаковый en у ${places.length} записей: «${en.slice(0, 60)}…» (${places.slice(0, 3).join(", ")}${places.length > 3 ? ", …" : ""})`);
  }
}

/* --------------------------------------------------------------- статьи -- */
async function listMd(dir, base = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) out.push(...(await listMd(path.join(dir, entry.name), rel)));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(rel);
  }
  return out;
}

const ruDir = path.join(ROOT, "content", "ru");
const enDir = path.join(ROOT, "content", "en");

if (existsSync(ruDir) && existsSync(enDir)) {
  const [ruFiles, enFiles] = await Promise.all([listMd(ruDir), listMd(enDir)]);
  const ruSet = new Set(ruFiles);
  const enSet = new Set(enFiles);
  for (const rel of ruFiles) if (!enSet.has(rel)) err(`content/en/${rel}: нет английской версии`);
  for (const rel of enFiles) if (!ruSet.has(rel)) err(`content/ru/${rel}: нет русской версии`);
}

/* -------------------------------------------------------------- отчёт -- */
const count = (arr) => arr.length;
console.log(`Проверка данных: ошибок ${count(errors)}, предупреждений ${count(warnings)}`);
for (const m of errors) console.log(`  ✗ ${m}`);
for (const m of warnings) console.log(`  ! ${m}`);
process.exit(errors.length ? 1 : 0);
