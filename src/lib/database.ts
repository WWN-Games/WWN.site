/* ============================================================================
   WWN — данные страницы базы (database/): всё считается на сборке.
   Карточки отдаются статически; острову — только сериализуемый индекс,
   подписи интерфейса и готовая шкала статов.
   ============================================================================ */

import { getCollection } from "astro:content";

import { type DictKey, t } from "../i18n";
import type { Building, Faction, Tag, Text, Unit } from "./schemas";
import { href, type Lang, localeHref } from "./site";
import { foldSearch } from "./utils";
import { entrySlug, getPublished } from "./wiki";

/* — константы и базовые типы — */

export const TABS = ["factions", "units", "buildings"] as const;
export type TabId = (typeof TABS)[number];

export const CARD_TABS = ["units", "buildings"] as const;
export type CardTab = (typeof CARD_TABS)[number];

export const SORT_KEYS = ["name", "cost", "hp", "shield", "dps", "speed", "range"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const STAT_KEYS = ["hp", "shield", "dps", "speed", "range"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type TagGroup = Tag["group"];

const FALLBACK_COLOR = "#29b8ff";
const MIN_BAR = 10;

/* — шкала статов — */

export interface StatScaleEntry {
  lo: number;
  hi: number;
  median: number;
}

export type StatScale = Record<StatKey, StatScaleEntry | null>;

/** Готовая полоса: значения и проценты посчитаны на сборке. */
export interface StatBarData {
  key: StatKey;
  label: string;
  value: number;
  display: string;
  percent: number;
  medianPercent: number;
}

/* — карточки и фракции (серверные модели) — */

export interface DatabaseCard {
  id: string;
  tab: CardTab;
  faction: string;
  type: string;
  tags: string[];
  name: Text;
  desc: Text;
  role?: Text | undefined;
  cost: number;
  hp: number;
  buildTime: number;
  shield: number;
  dps: number;
  speed: number;
  range: number;
  strongVs?: string[] | Text | undefined;
  weakVs?: string[] | Text | undefined;
  draft: boolean;
  isNew: boolean;
  image?: string | undefined;
}

export interface DatabaseFaction {
  id: string;
  name: Text;
  color: string;
  emblemFile: string | null;
  desc: Text;
  motto?: Text | undefined;
  playstyle?: Text | undefined;
  specialty?: Text | undefined;
  strengths: string[];
  weaknesses: string[];
  subfactionLabel: string | null;
  counts: { units: number; buildings: number };
  hasWiki: boolean;
  wikiHref: string | null;
}

/* — сериализуемый индекс для острова — */

export interface ExplorerItem {
  id: string;
  tab: CardTab;
  faction: string;
  type: string;
  tags: string[];
  cost: number;
  hp: number;
  shield: number;
  dps: number;
  speed: number;
  range: number;
  buildTime: number;
  /** Свёрнутый foldSearch текст текущего языка: имя, роль, описание, теги. */
  searchText: string;
  name: Text;
}

export interface ExplorerFaction {
  id: string;
  name: Text;
  searchText: string;
}

export interface ExplorerTypeOption {
  value: string;
  label: string;
}

/** Опции типов по табам: у фракций типов нет. */
export type ExplorerTypes = Record<TabId, ExplorerTypeOption[]>;

export interface ExplorerTag {
  id: string;
  group: TagGroup;
  name: Text;
}

export interface ExplorerLabels {
  search: string;
  all: string;
  faction: string;
  type: string;
  tag: string;
  sortLabel: string;
  sort: Record<SortKey, string>;
  tagPanelTitle: string;
  tagApply: string;
  tagClear: string;
  tagGroups: Record<TagGroup, string>;
  empty: string;
  count: string;
}

export interface ExplorerData {
  items: ExplorerItem[];
  factions: ExplorerFaction[];
  types: ExplorerTypes;
  tags: ExplorerTag[];
  labels: ExplorerLabels;
}

export interface DatabaseData {
  cards: DatabaseCard[];
  factions: DatabaseFaction[];
  scale: StatScale;
  factionMap: Map<string, Faction>;
  tagMap: Map<string, Tag>;
  explorer: ExplorerData;
}

/* — текстовые помощники — */

/** Локализованный текст; пустая строка, если текста нет. */
export function pick(text: Text | undefined, lang: Lang): string {
  return text ? text[lang] : "";
}

/** Legacy-поле может быть массивом строк или локализованным текстом. */
export function pickList(value: string[] | Text | undefined, lang: Lang): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  const text = value[lang];
  return text ? [text] : [];
}

export function tagLabel(tags: Map<string, Tag>, id: string, lang: Lang): string {
  return tags.get(id)?.name[lang] ?? id;
}

export function factionName(factions: Map<string, Faction>, id: string, lang: Lang): string {
  return factions.get(id)?.name[lang] ?? id;
}

export function factionColor(factions: Map<string, Faction>, id: string): string {
  return safeColor(factions.get(id)?.color);
}

export function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/** Путь картинки: id по умолчанию, item.image переопределяет, "" скрывает. */
export function resolveImage(image: string | undefined, id: string): string | null {
  if (image === "") return null;
  const path = image ? image.replace(/^assets\//, "") : `img/database/${id}.avif`;
  return href(path);
}

function safeColor(color: string | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK_COLOR;
}

function emblemFileName(emblem: string): string | null {
  const file = emblem.split("/").pop();
  return file && /\.svg$/i.test(file) ? file : null;
}

/* — подписи типов — */

const TYPE_KEYS: Record<string, DictKey> = {
  ground: "database.type.ground",
  air: "database.type.air",
  naval: "database.type.naval",
  space: "database.type.space",
  support: "database.type.support",
  economy: "database.type.economy",
  defense: "database.type.defense",
  structure: "database.type.structure",
};

export function typeLabel(type: string, lang: Lang): string {
  const key = TYPE_KEYS[type];
  return key ? t(lang, key) : type;
}

/* — шкала: логарифм с устойчивыми опорами p5/p95 и медианой — */

function valueAt(values: number[], quantile: number): number {
  return values[Math.min(values.length - 1, Math.round(quantile * (values.length - 1)))] ?? 0;
}

function medianOf(values: number[]): number {
  const mid = Math.floor(values.length / 2);
  if (values.length % 2) return values[mid] ?? 0;
  return ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
}

/** Шкала считается один раз по всей базе, чтобы раскладка не зависела от фильтров. */
export function computeScale(cards: DatabaseCard[]): StatScale {
  const scale = {} as Record<StatKey, StatScaleEntry | null>;
  for (const key of STAT_KEYS) {
    const values = cards
      .map((card) => card[key])
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    if (!values.length) {
      scale[key] = null;
      continue;
    }
    const lo = valueAt(values, 0.05);
    const p95 = valueAt(values, 0.95);
    const max = values[values.length - 1] ?? 0;
    scale[key] = { lo, hi: max > p95 * 3 ? p95 : max, median: medianOf(values) };
  }
  return scale;
}

export function barPercent(value: number, key: StatKey, scale: StatScale): number {
  const entry = scale[key];
  if (!(value > 0) || !entry) return 0;
  const span = Math.log(entry.hi / entry.lo);
  if (!(span > 0)) return 100;
  const position = Math.log(value / entry.lo) / span;
  return Math.max(MIN_BAR, Math.min(100, Math.round(MIN_BAR + (100 - MIN_BAR) * position)));
}

/** Компактный формат значения полосы: 2 знака < 10, 1 знак < 1000, дальше целое. */
export function formatStat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude < 10) return String(Math.round(value * 100) / 100);
  if (magnitude < 1000) return String(Math.round(value * 10) / 10);
  return String(Math.round(value));
}

export function buildBars(card: DatabaseCard, lang: Lang, scale: StatScale): StatBarData[] {
  const bars: StatBarData[] = [];
  for (const key of STAT_KEYS) {
    const entry = scale[key];
    if (!entry) continue;
    const value = card[key];
    bars.push({
      key,
      label: t(lang, `database.${key}`),
      value,
      display: formatStat(value),
      percent: barPercent(value, key, scale),
      medianPercent: barPercent(entry.median, key, scale),
    });
  }
  return bars;
}

/* — сборка данных страницы — */

type CardData = Unit | Building;

function toCard(id: string, tab: CardTab, data: CardData): DatabaseCard {
  return {
    id,
    tab,
    faction: data.faction,
    type: data.type,
    tags: [...data.tags],
    name: data.name,
    desc: data.desc,
    role: data.role,
    cost: data.cost,
    hp: data.hp,
    buildTime: data.buildTime,
    shield: data.shield ?? 0,
    dps: data.dps ?? 0,
    speed: data.speed ?? 0,
    range: data.range ?? 0,
    strongVs: data.strongVs,
    weakVs: data.weakVs,
    draft: data.draft ?? false,
    isNew: data.new ?? false,
    image: data.image,
  };
}

function explorerLabels(lang: Lang): ExplorerLabels {
  return {
    search: t(lang, "database.search.placeholder"),
    all: t(lang, "database.filter.all"),
    faction: t(lang, "database.filter.faction"),
    type: t(lang, "database.filter.type"),
    tag: t(lang, "database.filter.tag"),
    sortLabel: t(lang, "database.sort.label"),
    sort: {
      name: t(lang, "database.sort.name"),
      cost: t(lang, "database.sort.cost"),
      hp: t(lang, "database.sort.hp"),
      shield: t(lang, "database.sort.shield"),
      dps: t(lang, "database.sort.dps"),
      speed: t(lang, "database.sort.speed"),
      range: t(lang, "database.sort.range"),
    },
    tagPanelTitle: t(lang, "database.tag.panelTitle"),
    tagApply: t(lang, "database.tag.apply"),
    tagClear: t(lang, "database.tag.clear"),
    tagGroups: {
      tier: t(lang, "database.tagGroup.tier"),
      class: t(lang, "database.tagGroup.class"),
      movement: t(lang, "database.tagGroup.movement"),
      mod: t(lang, "database.tagGroup.mod"),
    },
    empty: t(lang, "database.empty"),
    count: t(lang, "database.count"),
  };
}

/** Полный набор данных страницы для языка. Только сервер: содержит Map. */
export async function loadDatabase(lang: Lang): Promise<DatabaseData> {
  const [unitEntries, buildingEntries, factionEntries, tagEntries, published] = await Promise.all([
    getCollection("units"),
    getCollection("buildings"),
    getCollection("factions"),
    getCollection("tags"),
    getPublished(lang),
  ]);

  // Порядок фракций задаётся полем order: сначала Фенземская Республика и
  // Движение Протон, затем остальные (см. src/data/factions.json).
  factionEntries.sort((a, b) => a.data.order - b.data.order);

  const tagMap = new Map(tagEntries.map((entry) => [entry.id, entry.data]));
  const factionMap = new Map(factionEntries.map((entry) => [entry.id, entry.data]));

  const counts = new Map<string, { units: number; buildings: number }>();
  for (const entry of factionEntries) counts.set(entry.id, { units: 0, buildings: 0 });

  const cards: DatabaseCard[] = [
    ...unitEntries.map((entry) => toCard(entry.id, "units", entry.data)),
    ...buildingEntries.map((entry) => toCard(entry.id, "buildings", entry.data)),
  ];
  for (const card of cards) {
    const counter = counts.get(card.faction);
    if (counter) counter[card.tab] += 1;
  }

  const scale = computeScale(cards);

  const publishedSlugs = new Set(published.map((entry) => entrySlug(entry)));
  const factions: DatabaseFaction[] = factionEntries.map((entry) => {
    const data = entry.data;
    const parent =
      typeof data.subfaction === "string" ? factionMap.get(data.subfaction) : undefined;
    const subfactionLabel = data.subfaction
      ? parent
        ? t(lang, "database.subfactionOf", { name: parent.name[lang] })
        : t(lang, "database.subfaction")
      : null;
    const hasWiki = publishedSlugs.has(data.lore);
    return {
      id: entry.id,
      name: data.name,
      color: safeColor(data.color),
      emblemFile: emblemFileName(data.emblem),
      desc: data.desc,
      motto: data.motto,
      playstyle: data.playstyle,
      specialty: data.specialty,
      strengths: data.strengths?.[lang] ?? [],
      weaknesses: data.weaknesses?.[lang] ?? [],
      subfactionLabel,
      counts: counts.get(entry.id) ?? { units: 0, buildings: 0 },
      hasWiki,
      wikiHref: hasWiki ? localeHref(lang, `wiki/${data.lore}/`) : null,
    };
  });

  const items: ExplorerItem[] = cards.map((card) => {
    const tagText = card.tags.map((id) => `${id} ${tagLabel(tagMap, id, lang)}`).join(" ");
    return {
      id: card.id,
      tab: card.tab,
      faction: card.faction,
      type: card.type,
      tags: card.tags,
      cost: card.cost,
      hp: card.hp,
      shield: card.shield,
      dps: card.dps,
      speed: card.speed,
      range: card.range,
      buildTime: card.buildTime,
      searchText: foldSearch(
        `${card.name[lang]} ${card.role?.[lang] ?? ""} ${card.desc[lang]} ${tagText}`,
      ),
      name: card.name,
    };
  });

  const explorerFactions: ExplorerFaction[] = factions.map((faction) => ({
    id: faction.id,
    name: faction.name,
    searchText: foldSearch(`${faction.name[lang]} ${faction.desc[lang]}`),
  }));

  const typeOptions = (tab: CardTab): ExplorerTypeOption[] => {
    const seen = new Set<string>();
    const options: ExplorerTypeOption[] = [];
    for (const card of cards) {
      if (card.tab !== tab || seen.has(card.type)) continue;
      seen.add(card.type);
      options.push({ value: card.type, label: typeLabel(card.type, lang) });
    }
    return options;
  };

  return {
    cards,
    factions,
    scale,
    factionMap,
    tagMap,
    explorer: {
      items,
      factions: explorerFactions,
      types: { factions: [], units: typeOptions("units"), buildings: typeOptions("buildings") },
      tags: tagEntries.map((entry) => ({
        id: entry.id,
        group: entry.data.group,
        name: entry.data.name,
      })),
      labels: explorerLabels(lang),
    },
  };
}
