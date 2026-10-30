/* ============================================================================
   WWN — данные страницы базы (database/): всё считается на сборке.
   Карточки отдаются статически; острову — только сериализуемый индекс,
   подписи интерфейса и готовая шкала статов.
   ============================================================================ */

import { getCollection } from "astro:content";

import { type DictKey, t } from "../i18n";
import type { CompareGroup, CompareMetric } from "./compare";
import type { CardTab, SortKey, TabId } from "./database-constants";
import type { Building, Faction, Tag, Text, Unit } from "./schemas";
import { href, type Lang, localeHref } from "./site";
import { foldSearch } from "./utils";
import { entrySlug, getPublished } from "./wiki";

export type { CardTab, SortDirection, SortKey, TabId, TagMatchMode } from "./database-constants";
export { CARD_TABS, SORT_KEYS, TABS } from "./database-constants";

/* — константы и базовые типы — */

const STAT_KEYS = ["hp", "shield", "dps", "speed", "range"] as const;
type StatKey = (typeof STAT_KEYS)[number];

type TagGroup = Tag["group"];

const FALLBACK_COLOR = "#29b8ff";
const MIN_BAR = 10;

/* — шкала статов — */

interface StatScaleEntry {
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
  /** Локализованное имя: остров работает только с языком страницы. */
  name: string;
  factionName: string;
  factionColor: string;
  typeLabel: string;
  image: string | null;
  initials: string;
}

export interface ExplorerFaction {
  id: string;
  name: Text;
  color: string;
  counts: { units: number; buildings: number };
  searchText: string;
}

interface ExplorerTypeOption {
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
  clearSearch: string;
  all: string;
  faction: string;
  type: string;
  tag: string;
  sortLabel: string;
  sortAsc: string;
  sortDesc: string;
  resetFilters: string;
  sort: Record<SortKey, string>;
  tagPanelTitle: string;
  tagApply: string;
  tagClear: string;
  tagMode: {
    label: string;
    all: string;
    any: string;
    allHint: string;
    anyHint: string;
    preview: string;
    emptyHint: string;
  };
  tagGroups: Record<TagGroup, string>;
  count: string;
  compare: {
    title: string;
    add: string;
    addAria: string;
    removeAria: string;
    selected: string;
    hint: string;
    open: string;
    clear: string;
    limit: string;
    dialogTitle: string;
    close: string;
    onlyDiff: string;
    share: string;
    shared: string;
    shareError: string;
    removeCard: string;
    best: string;
    noDiff: string;
    addAnother: string;
    trayLabel: string;
    column: string;
    faction: string;
    type: string;
    tags: string;
    group: Record<CompareGroup, string>;
    metric: Record<CompareMetric, string>;
  };
}

interface ExplorerData {
  items: ExplorerItem[];
  factions: ExplorerFaction[];
  types: ExplorerTypes;
  tags: ExplorerTag[];
  labels: ExplorerLabels;
}

interface DatabaseData {
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

/** Канонический порядок типов в фильтре, а не порядок карточек в JSON. */
const TYPE_ORDER = Object.keys(TYPE_KEYS);

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
function computeScale(cards: DatabaseCard[]): StatScale {
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

function barPercent(value: number, key: StatKey, scale: StatScale): number {
  const entry = scale[key];
  if (!(value > 0) || !entry) return 0;
  const lo = Math.max(entry.lo, 1);
  const hi = Math.max(entry.hi, lo + 1);
  const span = Math.log(hi / lo);
  if (!(span > 0)) return 100;
  const position = Math.log(Math.max(value, lo) / lo) / span;
  return Math.max(MIN_BAR, Math.min(100, Math.round(MIN_BAR + (100 - MIN_BAR) * position)));
}

/** Компактный формат значения полосы: 2 знака < 10, 1 знак < 1000, дальше целое. */
function formatStat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude < 10) {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }
  if (magnitude < 1000) {
    const rounded = Math.round(value * 10) / 10;
    return String(rounded);
  }
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
    clearSearch: t(lang, "database.search.clear"),
    all: t(lang, "database.filter.all"),
    faction: t(lang, "database.filter.faction"),
    type: t(lang, "database.filter.type"),
    tag: t(lang, "database.filter.tag"),
    sortLabel: t(lang, "database.sort.label"),
    sortAsc: t(lang, "database.sort.asc"),
    sortDesc: t(lang, "database.sort.desc"),
    resetFilters: t(lang, "database.filter.reset"),
    sort: {
      name: t(lang, "database.sort.name"),
      cost: t(lang, "database.sort.cost"),
      buildTime: t(lang, "database.sort.buildTime"),
      hp: t(lang, "database.sort.hp"),
      shield: t(lang, "database.sort.shield"),
      dps: t(lang, "database.sort.dps"),
      speed: t(lang, "database.sort.speed"),
      range: t(lang, "database.sort.range"),
    },
    tagPanelTitle: t(lang, "database.tag.panelTitle"),
    tagApply: t(lang, "database.tag.apply"),
    tagClear: t(lang, "database.tag.clear"),
    tagMode: {
      label: t(lang, "database.tag.mode.label"),
      all: t(lang, "database.tag.mode.all"),
      any: t(lang, "database.tag.mode.any"),
      allHint: t(lang, "database.tag.mode.allHint"),
      anyHint: t(lang, "database.tag.mode.anyHint"),
      preview: t(lang, "database.tag.mode.preview"),
      emptyHint: t(lang, "database.tag.mode.emptyHint"),
    },
    tagGroups: {
      tier: t(lang, "database.tagGroup.tier"),
      class: t(lang, "database.tagGroup.class"),
      movement: t(lang, "database.tagGroup.movement"),
      mod: t(lang, "database.tagGroup.mod"),
    },
    count: t(lang, "database.count"),
    compare: {
      title: t(lang, "database.compare.title"),
      add: t(lang, "database.compare.add"),
      addAria: t(lang, "database.compare.addAria"),
      removeAria: t(lang, "database.compare.removeAria"),
      selected: t(lang, "database.compare.selected"),
      hint: t(lang, "database.compare.hint"),
      open: t(lang, "database.compare.open"),
      clear: t(lang, "database.compare.clear"),
      limit: t(lang, "database.compare.limit"),
      dialogTitle: t(lang, "database.compare.dialogTitle"),
      close: t(lang, "database.compare.close"),
      onlyDiff: t(lang, "database.compare.onlyDiff"),
      share: t(lang, "database.compare.share"),
      shared: t(lang, "database.compare.shared"),
      shareError: t(lang, "database.compare.shareError"),
      removeCard: t(lang, "database.compare.removeCard"),
      best: t(lang, "database.compare.best"),
      noDiff: t(lang, "database.compare.noDiff"),
      addAnother: t(lang, "database.compare.addAnother"),
      trayLabel: t(lang, "database.compare.trayLabel"),
      column: t(lang, "database.compare.column"),
      faction: t(lang, "database.compare.faction"),
      type: t(lang, "database.compare.type"),
      tags: t(lang, "database.compare.tags"),
      group: {
        identity: t(lang, "database.compare.group.identity"),
        cost: t(lang, "database.compare.group.cost"),
        survival: t(lang, "database.compare.group.survival"),
        offense: t(lang, "database.compare.group.offense"),
        mobility: t(lang, "database.compare.group.mobility"),
        efficiency: t(lang, "database.compare.group.efficiency"),
      },
      metric: {
        cost: t(lang, "database.compare.metric.cost"),
        buildTime: t(lang, "database.compare.metric.buildTime"),
        hp: t(lang, "database.compare.metric.hp"),
        shield: t(lang, "database.compare.metric.shield"),
        totalHp: t(lang, "database.compare.metric.totalHp"),
        dps: t(lang, "database.compare.metric.dps"),
        range: t(lang, "database.compare.metric.range"),
        speed: t(lang, "database.compare.metric.speed"),
        dpsPerCost: t(lang, "database.compare.metric.dpsPerCost"),
        hpPerCost: t(lang, "database.compare.metric.hpPerCost"),
      },
    },
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
    const name = card.name[lang];
    const cardFactionName = factionName(factionMap, card.faction, lang);
    const cardTypeLabel = typeLabel(card.type, lang);
    const tagText = [...new Set(card.tags.flatMap((id) => [id, tagLabel(tagMap, id, lang)]))].join(
      " ",
    );
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
        `${name} ${cardFactionName} ${cardTypeLabel} ${card.role?.[lang] ?? ""} ${card.desc[lang]} ${tagText}`,
      ),
      name,
      factionName: cardFactionName,
      factionColor: factionColor(factionMap, card.faction),
      typeLabel: cardTypeLabel,
      image: resolveImage(card.image, card.id),
      initials: initialsOf(name),
    };
  });

  const explorerFactions: ExplorerFaction[] = factions.map((faction) => ({
    id: faction.id,
    name: faction.name,
    color: faction.color,
    counts: faction.counts,
    searchText: foldSearch(`${faction.name[lang]} ${faction.desc[lang]}`),
  }));

  const typeOptions = (tab: CardTab): ExplorerTypeOption[] => {
    const present = new Set<string>();
    for (const card of cards) {
      if (card.tab === tab) present.add(card.type);
    }
    return [...present]
      .sort(
        (a, b) =>
          TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b) ||
          typeLabel(a, lang).localeCompare(typeLabel(b, lang), lang),
      )
      .map((value) => ({ value, label: typeLabel(value, lang) }));
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
