import { promises as fs } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { withDerivedDps } from "../../src/lib/cards.ts";
import type { CollectionName } from "../../src/lib/content-constants.ts";
import { UNLOAD_OPTIONS } from "../../src/lib/content-constants.ts";
import {
  buildingSchema,
  factionSchema,
  featSchema,
  gallerySchema,
  mapSchema,
  miscSchema,
  sectionSchema,
  tagSchema,
  unitSchema,
  videoSchema,
} from "../../src/lib/schemas.ts";
import { isSlug, isTagId } from "../shared/slug.ts";
import type {
  Card,
  CollectionItem,
  Faction,
  FeatItem,
  GalleryItemData,
  MapItem,
  Section,
  Tag,
  VideoItem,
} from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { collectionPath, readFactions, readItems, readSections, readTags } from "./data.ts";
import { atomicWrite, fileExists, HttpError, isInside, readText } from "./http.ts";
import { deleteJsonItem, updateJsonItem } from "./json-edit.ts";
import { runValidation } from "./validation.ts";

const PUBLIC_ROOT = path.join(SITE_ROOT, "public");
const SRC_ROOT = path.join(SITE_ROOT, "src");

const COLLECTION_SCHEMAS = {
  units: unitSchema,
  buildings: buildingSchema,
  misc: miscSchema,
  factions: factionSchema,
  tags: tagSchema,
  sections: sectionSchema,
  maps: mapSchema,
  gallery: gallerySchema,
  videos: videoSchema,
  feats: featSchema,
} as const;

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
      count: Math.max(1, Math.round(weapon.count ?? 1)),
      projectileCount: Math.max(1, Math.round(weapon.projectileCount ?? 1)),
      projectileDelay: Math.max(0, weapon.projectileDelay ?? 0),
      tags: [...new Set(stringArray(weapon.tags))],
    })),
    builder: item.builder
      ? {
          ...item.builder,
          healTags: [...new Set(stringArray(item.builder.healTags))],
        }
      : undefined,
    factories: item.factories?.length
      ? item.factories.map((factory) => ({
          ...factory,
          name: cleanText(factory.name),
          producedUnits: [...new Set(stringArray(factory.producedUnits))],
        }))
      : undefined,
    transports: item.transports?.length
      ? item.transports.map((transport) => ({
          ...transport,
          name: cleanText(transport.name),
          cargoTags: [...new Set(stringArray(transport.cargoTags))],
          unload: [...new Set(transport.unload)].filter((option) =>
            (UNLOAD_OPTIONS as readonly string[]).includes(option),
          ),
        }))
      : undefined,
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
  name: "units" | "buildings" | "misc",
  item: Card,
  originalId: string | undefined,
): Promise<Card> {
  item.id = item.id.trim();
  item.faction = item.faction.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  if (
    !Number.isFinite(item.cost) ||
    !Number.isFinite(item.energy) ||
    !Number.isFinite(item.hp) ||
    !Number.isFinite(item.buildTime)
  ) {
    throw new HttpError(400, "cost, energy, hp и buildTime должны быть числами");
  }
  if (item.energy < 0) throw new HttpError(400, "energy: не может быть отрицательной");
  for (const key of [
    "shield",
    "armor",
    "selfRegen",
    "shieldRegen",
    "speed",
    "turnSpeed",
    "range",
  ] as const) {
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
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const cardTagGroups = new Set(["tier", "class", "movement", "mod"]);
  const weaponTagGroups = new Set(["weapon", "sector"]);
  for (const tag of item.tags) {
    const entry = tagMap.get(tag);
    if (!entry) throw new HttpError(400, `Незарегистрированный тег «${tag}»`);
    if (!cardTagGroups.has(entry.group)) {
      throw new HttpError(400, `Тег «${tag}» не обычный тег карточки`);
    }
  }
  for (const [index, weapon] of (item.weapons ?? []).entries()) {
    if (!(weapon.fireDelay > 0)) {
      throw new HttpError(400, `weapons.${index}.fireDelay: должно быть больше нуля`);
    }
    if (!Number.isInteger(weapon.count) || weapon.count < 1) {
      throw new HttpError(400, `weapons.${index}.count: целое число больше нуля`);
    }
    if (!Number.isInteger(weapon.projectileCount ?? 1) || (weapon.projectileCount ?? 1) < 1) {
      throw new HttpError(400, `weapons.${index}.projectileCount: целое число больше нуля`);
    }
    if (!Number.isFinite(weapon.projectileDelay ?? 0) || (weapon.projectileDelay ?? 0) < 0) {
      throw new HttpError(400, `weapons.${index}.projectileDelay: число не меньше нуля`);
    }
    if (
      weapon.armourIgnoreAmount !== undefined &&
      (!Number.isFinite(weapon.armourIgnoreAmount) || weapon.armourIgnoreAmount < 0)
    ) {
      throw new HttpError(400, `weapons.${index}.armourIgnoreAmount: число не меньше нуля`);
    }
    for (const tag of weapon.tags) {
      const entry = tagMap.get(tag);
      if (!entry) throw new HttpError(400, `Оружие ${index + 1}: неизвестный тег «${tag}»`);
      if (!weaponTagGroups.has(entry.group)) {
        throw new HttpError(400, `Оружие ${index + 1}: тег «${tag}» не из групп weapon/sector`);
      }
    }
  }
  if (item.builder) {
    for (const tag of item.builder.healTags) {
      const entry = tagMap.get(tag);
      if (!entry) throw new HttpError(400, `Строитель: неизвестный тег «${tag}»`);
      if (!cardTagGroups.has(entry.group)) {
        throw new HttpError(400, `Строитель: тег «${tag}» не обычный тег карточки`);
      }
    }
  }
  const units = await readItems<Card>("units");
  const unitIds = new Set(units.map((unit) => unit.id));
  for (const [index, factory] of (item.factories ?? []).entries()) {
    if (!(factory.buildSpeed > 0)) {
      throw new HttpError(400, `factories.${index}.buildSpeed: должно быть больше нуля`);
    }
    for (const unitId of factory.producedUnits) {
      if (!unitIds.has(unitId)) {
        throw new HttpError(400, `Завод ${index + 1}: неизвестный юнит «${unitId}»`);
      }
    }
  }
  for (const [index, transport] of (item.transports ?? []).entries()) {
    if (!Number.isInteger(transport.seats) || transport.seats < 0) {
      throw new HttpError(400, `transports.${index}.seats: целое число не меньше нуля`);
    }
    for (const tag of transport.cargoTags) {
      const entry = tagMap.get(tag);
      if (!entry) throw new HttpError(400, `Транспорт ${index + 1}: неизвестный тег «${tag}»`);
      if (!cardTagGroups.has(entry.group)) {
        throw new HttpError(400, `Транспорт ${index + 1}: тег «${tag}» не обычный тег карточки`);
      }
    }
  }

  const buildings = await readItems<Card>("buildings");
  const misc = await readItems<Card>("misc");
  const other = [...units, ...buildings, ...misc].find(
    (card) => card.id === item.id && card.id !== originalId,
  );
  if (other) throw new HttpError(409, `id «${item.id}» уже используется`);
  if (originalId && originalId !== item.id) {
    const refs = await checkUnitReferences(originalId);
    if (refs.length > 0) {
      throw new HttpError(
        409,
        `Нельзя переименовать: юнит производится заводами ${refs.slice(0, 5).join(", ")}`,
      );
    }
  }

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

  const schema = name === "units" ? unitSchema : name === "buildings" ? buildingSchema : miscSchema;
  const parsed = schema.safeParse(cardPayload(item));
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля карточки", zodMessages(name, parsed.error));
  }

  /* Переносим файл только после успешной валидации, чтобы ошибка схемы
     не оставила JSON со старым id, а картинку — с новым именем. */
  if (originalId && originalId !== item.id) {
    await moveCardImage(originalId, item.id, item);
    if (item.image !== parsed.data.image) {
      if (item.image === undefined) delete parsed.data.image;
      else parsed.data.image = item.image;
    }
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
  if (typeof item.subfaction === "string") {
    const subfaction = item.subfaction.trim();
    if (subfaction) item.subfaction = subfaction;
    else delete item.subfaction;
  }
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
    const children = factions.filter((faction) => faction.subfaction === originalId);
    if (children.length > 0) {
      throw new HttpError(
        409,
        `Нельзя переименовать: на фракцию ссылаются подфракции ${children
          .slice(0, 5)
          .map((faction) => faction.id)
          .join(", ")}`,
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

  if (typeof item.subfaction === "string") {
    if (item.subfaction === item.id) {
      throw new HttpError(400, "subfaction: фракция не может быть родителем самой себе");
    }
    if (!factions.some((faction) => faction.id === item.subfaction)) {
      throw new HttpError(400, `subfaction: неизвестная фракция «${item.subfaction}»`);
    }
    const seen = new Set<string>([item.id]);
    let parentId: string | undefined = item.subfaction;
    while (parentId) {
      if (seen.has(parentId)) {
        throw new HttpError(400, "subfaction: обнаружен цикл родительских фракций");
      }
      seen.add(parentId);
      const parent = factions.find((faction) => faction.id === parentId);
      parentId = typeof parent?.subfaction === "string" ? parent.subfaction : undefined;
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

function ensureUniqueId(
  items: { id: string }[],
  id: string,
  originalId: string | undefined,
  label: string,
): void {
  if (items.some((item) => item.id === id && item.id !== originalId)) {
    throw new HttpError(409, `${label} «${id}» уже существует`);
  }
}

function cleanOptionalText(value: { ru?: string; en?: string } | undefined) {
  return cleanText(value);
}

async function validateMap(item: MapItem, originalId: string | undefined): Promise<MapItem> {
  item.id = item.id.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  item.image = item.image?.trim().replace(/^\/+/, "") || undefined;
  item.download = item.download?.trim() || undefined;
  const payload = {
    ...item,
    name: cleanText(item.name),
    desc: cleanText(item.desc),
    size: cleanOptionalText(item.size),
    mode: cleanOptionalText(item.mode),
    author: cleanOptionalText(item.author),
  };
  if (item.image) {
    const target = path.resolve(PUBLIC_ROOT, item.image);
    if (!isInside(PUBLIC_ROOT, target)) {
      throw new HttpError(400, "image: путь выходит за пределы public/");
    }
    if (!(await fileExists(target))) {
      throw new HttpError(400, `image: файл public/${item.image} не найден`);
    }
  }
  const parsed = mapSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля карты", zodMessages("map", parsed.error));
  }
  ensureUniqueId(await readItems<MapItem>("maps"), item.id, originalId, "Карта");
  return parsed.data;
}

async function validateGallery(
  item: GalleryItemData,
  originalId: string | undefined,
): Promise<GalleryItemData> {
  item.id = item.id.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  item.image = (item.image ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^src\//, "");
  const target = path.resolve(SRC_ROOT, item.image);
  if (!isInside(path.join(SRC_ROOT, "assets/img/gallery"), target)) {
    throw new HttpError(400, "image: путь должен вести в src/assets/img/gallery");
  }
  if (!(await fileExists(target))) {
    throw new HttpError(400, `image: файл src/${item.image} не найден`);
  }
  const parsed = gallerySchema.safeParse({ ...item, caption: cleanText(item.caption) });
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля галереи", zodMessages("gallery", parsed.error));
  }
  ensureUniqueId(await readItems<GalleryItemData>("gallery"), item.id, originalId, "Скриншот");
  return parsed.data;
}

async function validateVideo(item: VideoItem, originalId: string | undefined): Promise<VideoItem> {
  item.id = item.id.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  item.youtubeId = (item.youtubeId ?? "").trim();
  const parsed = videoSchema.safeParse({
    ...item,
    title: cleanText(item.title),
    desc: cleanOptionalText(item.desc),
  });
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля видео", zodMessages("video", parsed.error));
  }
  ensureUniqueId(await readItems<VideoItem>("videos"), item.id, originalId, "Видео");
  return parsed.data;
}

async function validateFeat(item: FeatItem, originalId: string | undefined): Promise<FeatItem> {
  item.id = item.id.trim();
  if (!isSlug(item.id)) throw new HttpError(400, "id: только латиница, цифры и дефис");
  item.image = item.image?.trim().replace(/^\/+/, "") || undefined;
  if (item.image) {
    const target = path.resolve(PUBLIC_ROOT, item.image);
    if (!isInside(PUBLIC_ROOT, target)) {
      throw new HttpError(400, "image: путь выходит за пределы public/");
    }
    if (!(await fileExists(target))) {
      throw new HttpError(400, `image: файл public/${item.image} не найден`);
    }
  }
  const parsed = featSchema.safeParse({
    ...item,
    name: cleanText(item.name),
    desc: cleanText(item.desc),
  });
  if (!parsed.success) {
    throw new HttpError(400, "Проверьте поля подвига", zodMessages("feat", parsed.error));
  }
  ensureUniqueId(await readItems<FeatItem>("feats"), item.id, originalId, "Подвиг");
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
  const cards = [
    ...(await readItems<Card>("units")),
    ...(await readItems<Card>("buildings")),
    ...(await readItems<Card>("misc")),
  ];
  return cards
    .filter((card) => {
      if (kind === "faction") return card.faction === id;
      return (
        card.tags.includes(id) ||
        (card.weapons ?? []).some((weapon) => weapon.tags.includes(id)) ||
        (card.builder?.healTags ?? []).includes(id) ||
        (card.transports ?? []).some((transport) => transport.cargoTags.includes(id))
      );
    })
    .map((card) => card.id);
}

async function checkUnitReferences(id: string): Promise<string[]> {
  const cards = [
    ...(await readItems<Card>("units")),
    ...(await readItems<Card>("buildings")),
    ...(await readItems<Card>("misc")),
  ];
  return cards
    .filter((card) => (card.factories ?? []).some((factory) => factory.producedUnits.includes(id)))
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
    case "misc":
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
    case "maps":
      normalized = (await validateMap(item as MapItem, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    case "gallery":
      normalized = (await validateGallery(
        item as GalleryItemData,
        originalId,
      )) as unknown as Record<string, unknown>;
      break;
    case "videos":
      normalized = (await validateVideo(item as VideoItem, originalId)) as unknown as Record<
        string,
        unknown
      >;
      break;
    case "feats":
      normalized = (await validateFeat(item as FeatItem, originalId)) as unknown as Record<
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

  /* Не теряем необязательные поля, которых ещё нет в Zod-схеме. */
  if (current) {
    const known = new Set(Object.keys(COLLECTION_SCHEMAS[name].shape));
    for (const [key, value] of Object.entries(current)) {
      if (!known.has(key)) payload[key] = value;
    }
  }

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
    const children = (await readFactions()).filter((faction) => faction.subfaction === id);
    if (children.length > 0) {
      throw new HttpError(
        409,
        `На фракцию ссылаются подфракции: ${children
          .slice(0, 5)
          .map((faction) => faction.id)
          .join(", ")}`,
      );
    }
  }
  if (name === "tags") {
    const refs = await checkCardReferences(id, "tag");
    if (refs.length > 0) {
      throw new HttpError(409, `Тег используется карточками: ${refs.slice(0, 5).join(", ")}`);
    }
  }
  if (name === "units") {
    const refs = await checkUnitReferences(id);
    if (refs.length > 0) {
      throw new HttpError(
        409,
        `Юнит производится заводами карточек: ${refs.slice(0, 5).join(", ")}`,
      );
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

  if (name === "units" || name === "buildings" || name === "misc") {
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
  if (name === "maps" || name === "feats") {
    const data = item as MapItem | FeatItem;
    const folder = name === "maps" ? "maps" : "feats";
    const root = path.join(PUBLIC_ROOT, `img/${folder}`);
    const image = data.image?.replace(/^\/+/, "");
    const relative = image ?? `img/${folder}/${data.id}.avif`;
    const target = path.resolve(PUBLIC_ROOT, relative);
    const usedElsewhere = items.some((other) => {
      const value = (other as MapItem | FeatItem).image?.replace(/^\/+/, "");
      return (value ?? `img/${folder}/${other.id}.avif`) === relative;
    });
    if (!usedElsewhere && isInside(root, target)) {
      await fs.rm(target, { force: true });
    }
  }
  // Картинку галереи не удаляем: один файл может использоваться несколькими
  // записями, а Astro всё равно не хранит ссылки на неё в JSON автоматически.

  return runValidation();
}
