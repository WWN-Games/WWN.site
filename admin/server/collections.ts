import { promises as fs } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  buildingSchema,
  factionSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
} from "../../src/lib/schemas.ts";
import type { Card, CollectionItem, Faction, Section, Tag } from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import {
  COLLECTION_FILES,
  type CollectionName,
  collectionPath,
  readFactions,
  readItems,
  readSections,
  readTags,
} from "./data.ts";
import { HttpError, atomicWrite, fileExists, isInside, readText } from "./http.ts";
import { deleteJsonItem, updateJsonItem } from "./json-edit.ts";
import { isSlug } from "./strings.ts";
import { runValidation } from "./validation.ts";

const PUBLIC_ROOT = path.join(SITE_ROOT, "public");
const SRC_ROOT = path.join(SITE_ROOT, "src");
const UNIT_TYPES = ["ground", "air", "naval", "space", "support"];
const BUILDING_TYPES = ["economy", "defense", "structure"];
const TAG_GROUPS = ["tier", "class", "movement", "mod"];
const SECTION_ICONS = ["book", "shield", "cube", "gear", "compass", "users", "clock", "rocket", "chat"];

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function localized(value: { ru?: string; en?: string } | undefined): { ru: string; en: string } {
  return { ru: value?.ru?.trim() ?? "", en: value?.en?.trim() ?? "" };
}

function optionalLocalized(value: { ru?: string; en?: string } | undefined): { ru: string; en: string } | undefined {
  const text = localized(value);
  if (!text.ru && !text.en) return undefined;
  return text;
}

function assertLocalized(value: { ru?: string; en?: string } | undefined, field: string): void {
  const text = localized(value);
  if (!text.ru) throw new HttpError(400, `${field}: не заполнено RU`);
  if (!text.en) throw new HttpError(400, `${field}: не заполнено EN`);
}

function zodMessages(prefix: string, error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string[] {
  return error.issues.map((issue) => {
    const at = issue.path.map(String).join(".");
    return `${prefix}${at ? `.${at}` : ""}: ${issue.message}`;
  });
}

function normalizeCard(item: Card): Record<string, unknown> {
  assertLocalized(item.name, "name");
  assertLocalized(item.desc, "desc");
  const result: Record<string, unknown> = {
    id: item.id.trim(),
    name: localized(item.name),
    faction: item.faction.trim(),
    type: item.type,
    desc: localized(item.desc),
    tags: [...new Set(stringArray(item.tags))],
    cost: item.cost,
    hp: item.hp,
    buildTime: item.buildTime,
  };
  for (const key of ["shield", "dps", "speed", "range"] as const) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  if (item.image !== undefined) result.image = item.image.replace(/^\/+/, "");
  const role = optionalLocalized(item.role);
  if (role) result.role = role;
  if (item.strongVs !== undefined) result.strongVs = item.strongVs;
  if (item.weakVs !== undefined) result.weakVs = item.weakVs;
  if (item.draft) result.draft = true;
  if (item.new) result.new = true;
  return result;
}

function normalizeFaction(item: Faction): Record<string, unknown> {
  assertLocalized(item.name, "name");
  assertLocalized(item.desc, "desc");
  const result: Record<string, unknown> = {
    id: item.id.trim(),
    order: item.order,
    name: localized(item.name),
    color: item.color.trim(),
    emblem: item.emblem.trim().replace(/^\/+/, "").replace(/^src\//, ""),
    lore: item.lore.trim(),
    desc: localized(item.desc),
  };
  const motto = optionalLocalized(item.motto);
  if (motto) result.motto = motto;
  const playstyle = optionalLocalized(item.playstyle);
  if (playstyle) result.playstyle = playstyle;
  const specialty = optionalLocalized(item.specialty);
  if (specialty) result.specialty = specialty;
  if (item.strengths) {
    result.strengths = {
      ru: stringArray(item.strengths.ru),
      en: stringArray(item.strengths.en),
    };
  }
  if (item.weaknesses) {
    result.weaknesses = {
      ru: stringArray(item.weaknesses.ru),
      en: stringArray(item.weaknesses.en),
    };
  }
  if (item.subfaction === true || (typeof item.subfaction === "string" && item.subfaction.trim())) {
    result.subfaction = item.subfaction;
  }
  return result;
}

function normalizeTag(item: Tag): Record<string, unknown> {
  assertLocalized(item.name, "name");
  return {
    id: item.id.trim(),
    name: localized(item.name),
    group: item.group,
  };
}

function normalizeSection(item: Section): Record<string, unknown> {
  assertLocalized(item.title, "title");
  assertLocalized(item.desc, "desc");
  return {
    id: item.id.trim(),
    icon: item.icon,
    order: item.order,
    title: localized(item.title),
    desc: localized(item.desc),
  };
}

async function validateCard(
  name: "units" | "buildings",
  item: Card,
  originalId: string | undefined,
): Promise<void> {
  if (!isSlug(item.id.trim())) throw new HttpError(400, "id: только латиница, цифры и дефис");
  const typeValues = name === "units" ? UNIT_TYPES : BUILDING_TYPES;
  if (!typeValues.includes(item.type)) throw new HttpError(400, `type: неизвестный тип «${item.type}»`);
  if (!Number.isFinite(item.cost) || !Number.isFinite(item.hp) || !Number.isFinite(item.buildTime)) {
    throw new HttpError(400, "cost, hp и buildTime должны быть числами");
  }
  for (const key of ["shield", "dps", "speed", "range"] as const) {
    const value = item[key];
    if (value !== undefined && !Number.isFinite(value)) {
      throw new HttpError(400, `${key}: должно быть числом`);
    }
  }

  const schema = name === "units" ? unitSchema : buildingSchema;
  const parsed = schema.safeParse(normalizeCard(item));
  if (!parsed.success) throw new HttpError(400, "Проверьте поля карточки", zodMessages(name, parsed.error));

  const factions = await readFactions();
  if (!factions.some((faction) => faction.id === item.faction)) {
    throw new HttpError(400, `Неизвестная фракция «${item.faction}»`);
  }
  const tags = await readTags();
  const tagIds = new Set(tags.map((tag) => tag.id));
  for (const tag of item.tags) {
    if (!tagIds.has(tag)) throw new HttpError(400, `Незарегистрированный тег «${tag}»`);
  }

  const units = await readItems<Card>("units");
  const buildings = await readItems<Card>("buildings");
  const other = [...units, ...buildings].find(
    (card) => card.id === item.id && card.id !== originalId,
  );
  if (other) throw new HttpError(409, `id «${item.id}» уже используется`);

  let image = item.image;
  if (image === undefined) {
    const fallback = path.join(PUBLIC_ROOT, "img/database", `${item.id}.avif`);
    if (!(await fileExists(fallback))) image = "";
  }
  if (image !== undefined && image !== "") {
    const target = path.resolve(PUBLIC_ROOT, image.replace(/^\/+/, ""));
    if (!isInside(PUBLIC_ROOT, target)) throw new HttpError(400, "image: путь выходит за пределы public/");
    if (!(await fileExists(target))) throw new HttpError(400, `image: файл public/${image} не найден`);
  }
  item.image = image;
}

async function validateFaction(item: Faction, originalId: string | undefined): Promise<void> {
  if (!isSlug(item.id.trim())) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (!Number.isInteger(item.order) || item.order <= 0) {
    throw new HttpError(400, "order: целое число больше нуля");
  }
  if (!/^#[0-9a-f]{6}$/i.test(item.color)) throw new HttpError(400, "color: нужен формат #rrggbb");
  const parsed = factionSchema.safeParse(normalizeFaction(item));
  if (!parsed.success) throw new HttpError(400, "Проверьте поля фракции", zodMessages("faction", parsed.error));

  const factions = await readFactions();
  if (factions.some((faction) => faction.id === item.id && faction.id !== originalId)) {
    throw new HttpError(409, `Фракция «${item.id}» уже существует`);
  }
  const duplicateOrder = factions.find(
    (faction) => faction.order === item.order && faction.id !== originalId && faction.id !== item.id,
  );
  if (duplicateOrder) throw new HttpError(409, `order ${item.order} уже занят фракцией «${duplicateOrder.id}»`);

  const emblem = item.emblem.trim().replace(/^\/+/, "").replace(/^src\//, "");
  const emblemFile = path.resolve(SRC_ROOT, emblem);
  if (!isInside(path.join(SRC_ROOT, "assets/img/factions"), emblemFile)) {
    throw new HttpError(400, "emblem: путь должен вести в src/assets/img/factions");
  }
  if (!(await fileExists(emblemFile))) throw new HttpError(400, `emblem: файл не найден (${emblem})`);

  if (typeof item.subfaction === "string" && item.subfaction.trim()) {
    if (item.subfaction === item.id) throw new HttpError(400, "subfaction: фракция не может быть родителем самой себе");
    if (!factions.some((faction) => faction.id === item.subfaction)) {
      throw new HttpError(400, `subfaction: неизвестная фракция «${item.subfaction}»`);
    }
  }
}

async function validateTag(item: Tag, originalId: string | undefined): Promise<void> {
  if (!isSlug(item.id.trim())) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (!TAG_GROUPS.includes(item.group)) throw new HttpError(400, `group: неизвестная группа «${item.group}»`);
  const parsed = tagSchema.safeParse(normalizeTag(item));
  if (!parsed.success) throw new HttpError(400, "Проверьте поля тега", zodMessages("tag", parsed.error));
  const tags = await readTags();
  if (tags.some((tag) => tag.id === item.id && tag.id !== originalId)) {
    throw new HttpError(409, `Тег «${item.id}» уже существует`);
  }
}

async function validateSection(item: Section, originalId: string | undefined): Promise<void> {
  if (!isSlug(item.id.trim())) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (!Number.isInteger(item.order) || item.order <= 0) {
    throw new HttpError(400, "order: целое число больше нуля");
  }
  if (!SECTION_ICONS.includes(item.icon)) throw new HttpError(400, `icon: неизвестная иконка «${item.icon}»`);
  const parsed = sectionSchema.safeParse(normalizeSection(item));
  if (!parsed.success) throw new HttpError(400, "Проверьте поля раздела", zodMessages("section", parsed.error));
  const sections = await readSections();
  if (sections.some((section) => section.order === item.order && section.id !== originalId && section.id !== item.id)) {
    throw new HttpError(409, `order ${item.order} уже занят разделом`);
  }
  if (sections.some((section) => section.id === item.id && section.id !== originalId)) {
    throw new HttpError(409, `Раздел «${item.id}» уже существует`);
  }
}

async function moveCardImage(oldId: string, newId: string, item: Card): Promise<void> {
  const oldDefault = path.join(PUBLIC_ROOT, "img/database", `${oldId}.avif`);
  const newDefault = path.join(PUBLIC_ROOT, "img/database", `${newId}.avif`);
  if (item.image === undefined || item.image === "") {
    if ((await fileExists(oldDefault)) && !(await fileExists(newDefault))) {
      await fs.rename(oldDefault, newDefault);
    }
    return;
  }
  const normalized = item.image.replace(/^\/+/, "");
  if (normalized.startsWith(`img/database/${oldId}.`)) {
    const next = `img/database/${newId}${normalized.slice(`img/database/${oldId}`.length)}`;
    const oldFile = path.join(PUBLIC_ROOT, normalized);
    const newFile = path.join(PUBLIC_ROOT, next);
    if ((await fileExists(oldFile)) && !(await fileExists(newFile))) {
      await fs.rename(oldFile, newFile);
      item.image = next;
    }
  }
}

async function checkCardReferences(id: string, kind: "faction" | "tag"): Promise<string[]> {
  const cards = [...(await readItems<Card>("units")), ...(await readItems<Card>("buildings"))];
  return cards
    .filter((card) => (kind === "faction" ? card.faction === id : card.tags.includes(id)))
    .map((card) => card.id);
}

async function checkSectionArticles(id: string): Promise<boolean> {
  for (const lang of ["ru", "en"] as const) {
    const dir = path.join(SITE_ROOT, "src/content/wiki", lang, id);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && entry.name.endsWith(".md"))) return true;
    } catch {
      // папки может не быть
    }
  }
  return false;
}

export async function listCollection(name: CollectionName): Promise<CollectionItem[]> {
  return readItems<CollectionItem>(name);
}

export async function getCollectionItem(name: CollectionName, id: string): Promise<CollectionItem> {
  const items = await readItems<CollectionItem>(name);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new HttpError(404, `Запись «${id}» не найдена`);
  return item;
}

export async function saveCollectionItem(
  name: CollectionName,
  item: CollectionItem,
  originalId?: string,
): Promise<{ item: CollectionItem; validation: ReturnType<typeof runValidation> }> {
  if (item === null || typeof item !== "object") throw new HttpError(400, "Нет данных записи");
  const items = await readItems<CollectionItem>(name);
  const index = originalId ? items.findIndex((entry) => entry.id === originalId) : -1;
  if (originalId && index === -1) throw new HttpError(404, `Запись «${originalId}» не найдена`);

  let normalized: Record<string, unknown>;
  switch (name) {
    case "units":
    case "buildings": {
      const card = item as Card;
      await validateCard(name, card, originalId);
      if (originalId && originalId !== card.id) await moveCardImage(originalId, card.id, card);
      normalized = normalizeCard(card);
      break;
    }
    case "factions": {
      const faction = item as Faction;
      await validateFaction(faction, originalId);
      normalized = normalizeFaction(faction);
      break;
    }
    case "tags": {
      const tag = item as Tag;
      await validateTag(tag, originalId);
      normalized = normalizeTag(tag);
      break;
    }
    case "sections": {
      const section = item as Section;
      await validateSection(section, originalId);
      normalized = normalizeSection(section);
      break;
    }
    default:
      throw new HttpError(400, "Неизвестная коллекция");
  }

  const file = collectionPath(name);
  const raw = await readText(file);

  if (originalId && originalId === (normalized as { id: string }).id && index >= 0) {
    const current = items[index];
    if (isDeepStrictEqual(current, normalized)) {
      return {
        item: current,
        validation: runValidation(),
      };
    }
  }

  const nextRaw = updateJsonItem(
    raw,
    name,
    normalized as unknown as { id: string },
    originalId,
  );
  await atomicWrite(file, nextRaw);

  return {
    item: normalized as unknown as CollectionItem,
    validation: runValidation(),
  };
}

export async function deleteCollectionItem(
  name: CollectionName,
  id: string,
): Promise<ReturnType<typeof runValidation>> {
  const items = await readItems<CollectionItem>(name);
  const index = items.findIndex((entry) => entry.id === id);
  if (index === -1) throw new HttpError(404, `Запись «${id}» не найдена`);

  if (name === "factions") {
    const refs = await checkCardReferences(id, "faction");
    if (refs.length > 0) {
      throw new HttpError(409, `Фракция используется карточками: ${refs.slice(0, 5).join(", ")}`);
    }
  }
  if (name === "tags") {
    const refs = await checkCardReferences(id, "tag");
    if (refs.length > 0) {
      throw new HttpError(409, `Тег используется карточками: ${refs.slice(0, 5).join(", ")}`);
    }
  }
  if (name === "sections" && (await checkSectionArticles(id))) {
    throw new HttpError(409, `В разделе «${id}» ещё есть статьи`);
  }

  const item = items[index] as CollectionItem;
  items.splice(index, 1);

  const file = collectionPath(name);
  const raw = await readText(file);
  await atomicWrite(file, deleteJsonItem(raw, name, id));

  if (name === "units" || name === "buildings") {
    const card = item as Card;
    const image = card.image?.replace(/^\/+/, "");
    if (image && image.startsWith("img/database/")) {
      await fs.rm(path.join(PUBLIC_ROOT, image), { force: true });
    } else if (image === undefined) {
      await fs.rm(path.join(PUBLIC_ROOT, "img/database", `${card.id}.avif`), { force: true });
    }
  }

  return runValidation();
}

export async function collectionFilePath(name: CollectionName): Promise<string> {
  return COLLECTION_FILES[name];
}

export async function readCollectionRaw(name: CollectionName): Promise<unknown> {
  const file = collectionPath(name);
  return JSON.parse(await readText(file)) as unknown;
}

export { COLLECTION_FILES, collectionPath };
