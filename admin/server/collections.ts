import { promises as fs } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { withDerivedDps } from "../../src/lib/cards.ts";
import type { CollectionName } from "../../src/lib/collections.ts";
import { BUILDING_TYPES, UNIT_TYPES } from "../../src/lib/content-constants.ts";
import {
  buildingSchema,
  factionSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
} from "../../src/lib/schemas.ts";
import type { Card, CollectionItem, Faction, Section, Tag } from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { collectionPath, readFactions, readItems, readSections, readTags } from "./data.ts";
import { atomicWrite, fileExists, HttpError, isInside, readText } from "./http.ts";
import { deleteJsonItem, updateJsonItem } from "./json-edit.ts";
import { isSlug, isTagId } from "./strings.ts";
import { runValidation } from "./validation.ts";

const PUBLIC_ROOT = path.join(SITE_ROOT, "public");
const SRC_ROOT = path.join(SITE_ROOT, "src");

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function zodMessages(
  prefix: string,
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
): string[] {
  return error.issues.map((issue) => {
    const at = issue.path.map(String).join(".");
    return `${prefix}${at ? `.${at}` : ""}: ${issue.message}`;
  });
}

/** Обрезает текст и убирает пустой EN — схема сама подставит en = ru. */
function cleanText(
  value: { ru?: string; en?: string } | undefined,
): { ru: string; en?: string } | undefined {
  if (!value) return undefined;
  const ru = value.ru?.trim() ?? "";
  const en = value.en?.trim() ?? "";
  if (!ru && !en) return undefined;
  return en ? { ru: ru || en, en } : { ru: ru || en };
}

function cleanTextOrList(
  value: string[] | { ru?: string; en?: string } | undefined,
): string[] | { ru: string; en?: string } | undefined {
  if (Array.isArray(value)) return stringArray(value);
  return cleanText(value);
}

function cardPayload(item: Card): Record<string, unknown> {
  const derived = withDerivedDps(item);
  return {
    ...derived,
    id: item.id.trim(),
    name: cleanText(item.name),
    faction: item.faction.trim(),
    desc: cleanText(item.desc),
    tags: [...new Set(stringArray(item.tags))],
    image: item.image?.replace(/^\/+/, ""),
    role: cleanText(item.role),
    strongVs: cleanTextOrList(item.strongVs),
    weakVs: cleanTextOrList(item.weakVs),
    weapons: derived.weapons?.map((weapon) => ({
      ...weapon,
      name: cleanText(weapon.name),
    })),
  };
}

function factionPayload(item: Faction): Record<string, unknown> {
  return {
    ...item,
    id: item.id.trim(),
    name: cleanText(item.name),
    color: item.color.trim(),
    emblem: item.emblem
      .trim()
      .replace(/^\/+/, "")
      .replace(/^src\//, ""),
    lore: item.lore.trim(),
    desc: cleanText(item.desc),
    motto: cleanText(item.motto),
    playstyle: cleanText(item.playstyle),
    specialty: cleanText(item.specialty),
    strengths: item.strengths
      ? { ru: stringArray(item.strengths.ru), en: stringArray(item.strengths.en) }
      : undefined,
    weaknesses: item.weaknesses
      ? { ru: stringArray(item.weaknesses.ru), en: stringArray(item.weaknesses.en) }
      : undefined,
    subfaction: item.subfaction,
  };
}

function tagPayload(item: Tag): Record<string, unknown> {
  return { id: item.id.trim(), name: cleanText(item.name), group: item.group };
}

function sectionPayload(item: Section): Record<string, unknown> {
  return {
    id: item.id.trim(),
    icon: item.icon,
    order: item.order,
    title: cleanText(item.title),
    desc: cleanText(item.desc),
  };
}

/** Сохраняет порядок ключей существующей записи, чтобы diff оставался маленьким. */
function orderLike(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    if (key in next) result[key] = next[key];
  }
  for (const key of Object.keys(next)) {
    if (!(key in result)) result[key] = next[key];
  }
  return result;
}

async function validateCard(
  name: "units" | "buildings",
  item: Card,
  originalId: string | undefined,
): Promise<Card> {
  item.id = item.id.trim();
  item.faction = item.faction.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  const typeValues = name === "units" ? UNIT_TYPES : BUILDING_TYPES;
  if (!(typeValues as readonly string[]).includes(item.type)) {
    throw new HttpError(400, `type: неизвестный тип «${item.type}»`);
  }
  if (
    !Number.isFinite(item.cost) ||
    !Number.isFinite(item.hp) ||
    !Number.isFinite(item.buildTime)
  ) {
    throw new HttpError(400, "cost, hp и buildTime должны быть числами");
  }
  for (const key of ["shield", "selfRegen", "shieldRegen", "dps", "speed", "range"] as const) {
    const value = item[key];
    if (value !== undefined && !Number.isFinite(value)) {
      throw new HttpError(400, `${key}: должно быть числом`);
    }
  }

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
    if (!isInside(PUBLIC_ROOT, target))
      throw new HttpError(400, "image: путь выходит за пределы public/");
    if (!(await fileExists(target)))
      throw new HttpError(400, `image: файл public/${image} не найден`);
  }
  item.image = image?.replace(/^\/+/, "");

  if (originalId && originalId !== item.id) await moveCardImage(originalId, item.id, item);

  const schema = name === "units" ? unitSchema : buildingSchema;
  const parsed = schema.safeParse(cardPayload(item));
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля карточки", zodMessages(name, parsed.error));
  }
  return parsed.data;
}

async function validateFaction(item: Faction, originalId: string | undefined): Promise<Faction> {
  item.id = item.id.trim();
  item.color = item.color.trim();
  item.emblem = item.emblem
    .trim()
    .replace(/^\/+/, "")
    .replace(/^src\//, "");
  item.lore = item.lore.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (!Number.isInteger(item.order) || item.order <= 0) {
    throw new HttpError(400, "order: целое число больше нуля");
  }
  if (!/^#[0-9a-f]{6}$/i.test(item.color)) throw new HttpError(400, "color: нужен формат #rrggbb");

  const factions = await readFactions();
  if (factions.some((faction) => faction.id === item.id && faction.id !== originalId)) {
    throw new HttpError(409, `Фракция «${item.id}» уже существует`);
  }
  if (originalId && originalId !== item.id) {
    const refs = await checkCardReferences(originalId, "faction");
    if (refs.length > 0) {
      throw new HttpError(
        409,
        `Нельзя переименовать: фракция используется карточками ${refs.slice(0, 5).join(", ")}`,
      );
    }
  }
  const duplicateOrder = factions.find(
    (faction) =>
      faction.order === item.order && faction.id !== originalId && faction.id !== item.id,
  );
  if (duplicateOrder)
    throw new HttpError(409, `order ${item.order} уже занят фракцией «${duplicateOrder.id}»`);

  const emblemFile = path.resolve(SRC_ROOT, item.emblem);
  if (!isInside(path.join(SRC_ROOT, "assets/img/factions"), emblemFile)) {
    throw new HttpError(400, "emblem: путь должен вести в src/assets/img/factions");
  }
  if (!(await fileExists(emblemFile))) {
    throw new HttpError(400, `emblem: файл не найден (${item.emblem})`);
  }

  if (typeof item.subfaction === "string" && item.subfaction.trim()) {
    item.subfaction = item.subfaction.trim();
    if (item.subfaction === item.id) {
      throw new HttpError(400, "subfaction: фракция не может быть родителем самой себе");
    }
    if (!factions.some((faction) => faction.id === item.subfaction)) {
      throw new HttpError(400, `subfaction: неизвестная фракция «${item.subfaction}»`);
    }
  }

  const parsed = factionSchema.safeParse(factionPayload(item));
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля фракции", zodMessages("faction", parsed.error));
  }
  return parsed.data;
}

async function validateTag(item: Tag, originalId: string | undefined): Promise<Tag> {
  item.id = item.id.trim();
  if (!isTagId(item.id)) {
    throw new HttpError(400, "id: латиница, цифры, дефис, подчёркивание и +");
  }
  const parsed = tagSchema.safeParse(tagPayload(item));
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля тега", zodMessages("tag", parsed.error));
  }
  const tags = await readTags();
  if (tags.some((tag) => tag.id === item.id && tag.id !== originalId)) {
    throw new HttpError(409, `Тег «${item.id}» уже существует`);
  }
  if (originalId && originalId !== item.id) {
    const refs = await checkCardReferences(originalId, "tag");
    if (refs.length > 0) {
      throw new HttpError(
        409,
        `Нельзя переименовать: тег используется карточками ${refs.slice(0, 5).join(", ")}`,
      );
    }
  }
  return parsed.data;
}

async function validateSection(item: Section, originalId: string | undefined): Promise<Section> {
  item.id = item.id.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (!Number.isInteger(item.order) || item.order <= 0) {
    throw new HttpError(400, "order: целое число больше нуля");
  }
  const parsed = sectionSchema.safeParse(sectionPayload(item));
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля раздела", zodMessages("section", parsed.error));
  }
  const sections = await readSections();
  if (
    sections.some(
      (section) =>
        section.order === item.order && section.id !== originalId && section.id !== item.id,
    )
  ) {
    throw new HttpError(409, `order ${item.order} уже занят разделом`);
  }
  if (sections.some((section) => section.id === item.id && section.id !== originalId)) {
    throw new HttpError(409, `Раздел «${item.id}» уже существует`);
  }
  if (originalId && originalId !== item.id && (await checkSectionArticles(originalId))) {
    throw new HttpError(409, "Нельзя переименовать раздел, пока в нём есть статьи");
  }
  return parsed.data;
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
    case "buildings":
      normalized = (await validateCard(name, item as Card, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    case "factions":
      normalized = (await validateFaction(item as Faction, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    case "tags":
      normalized = (await validateTag(item as Tag, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    case "sections":
      normalized = (await validateSection(item as Section, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    default:
      throw new HttpError(400, "Неизвестная коллекция");
  }

  const file = collectionPath(name);
  const raw = await readText(file);
  const current = index >= 0 ? (items[index] as unknown as Record<string, unknown>) : undefined;
  const payload = current ? orderLike(current, normalized) : normalized;

  if (
    originalId &&
    originalId === (payload as { id: string }).id &&
    current &&
    isDeepStrictEqual(current, payload)
  ) {
    return {
      item: current as unknown as CollectionItem,
      validation: runValidation(),
    };
  }

  const nextRaw = updateJsonItem(raw, name, payload as unknown as { id: string }, originalId);
  await atomicWrite(file, nextRaw);

  return {
    item: payload as unknown as CollectionItem,
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
    const imageRoot = path.join(PUBLIC_ROOT, "img/database");
    const image = card.image?.replace(/^\/+/, "");
    const target = image?.startsWith("img/database/")
      ? path.resolve(PUBLIC_ROOT, image)
      : image === undefined
        ? path.join(imageRoot, `${card.id}.avif`)
        : null;
    if (target && isInside(imageRoot, target)) {
      await fs.rm(target, { force: true });
    }
  }

  return runValidation();
}
