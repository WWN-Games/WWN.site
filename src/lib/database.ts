/* ============================================================================
   WWN — данные страницы базы (database/): всё считается на сборке.
   Карточки отдаются статически; острову — только сериализуемый индекс,
   подписи интерфейса и стартовые шкалы статов по вкладкам.
   ============================================================================ */

import { getCollection } from "astro:content";

import { type DictKey, t } from "../i18n";
import {
  barPercent,
  computeStatScale,
  formatStat,
  STAT_KEYS,
  type StatKey,
  type StatScale,
  weaponDps,
} from "./card-stats";
import { isBadgeNew, withDerivedCard } from "./cards";
import type { CompareGroup, CompareMetric } from "./compare";
import type { CardTab, SortKey } from "./database-constants";
import { FTL_JUMP_TAGS, FTL_TYPE_LABEL } from "./ftl";
import type {
  Atmosphere,
  Builder,
  Building,
  ChargeDefense,
  DomeShield,
  Faction,
  Factory,
  FtlJump,
  Misc,
  Tag,
  Text,
  Transport,
  Unit,
  Weapon,
} from "./schemas";
import { href, type Lang, localeHref } from "./site";
import { foldSearch } from "./utils";
import { entrySlug, getPublished } from "./wiki";

export type { UnloadOption } from "./content-constants";
export type { CardTab, SortDirection, SortKey, TabId } from "./database-constants";

/* — константы и базовые типы — */

export type { StatKey, StatScale } from "./card-stats";

type TagGroup = Tag["group"];

const FALLBACK_COLOR = "#29b8ff";

/** Готовая полоса: проценты посчитаны на сборке и обновляются на клиенте. */
export interface StatBarData {
  key: StatKey;
  value: number;
  label: string;
  display: string;
  percent: number;
  medianPercent: number;
}

/* — карточки и фракции (серверные модели) — */

export interface DatabaseCard {
  id: string;
  tab: CardTab;
  faction: string;
  tags: string[];
  name: Text;
  desc: Text;
  role?: Text | undefined;
  cost: number;
  energy: number;
  fullCost: number;
  hp: number;
  shield: number;
  armor: number;
  selfRegen: number;
  shieldRegen: number;
  dps: number;
  mainDps: number;
  weapons: Weapon[];
  missileDefense?: ChargeDefense | undefined;
  torpedoDefense?: ChargeDefense | undefined;
  laserDefense?: DomeShield | undefined;
  domeShield?: DomeShield | undefined;
  atmosphere?: Atmosphere | undefined;
  tacticalInstallation: boolean;
  nuclearInstallation: boolean;
  hyperInstallation: boolean;
  tacticalMissileDefense: boolean;
  nuclearMissileDefense: boolean;
  hyperMissileDefense: boolean;
  ftlJump?: FtlJump | undefined;
  builder?: Builder | undefined;
  factories: Factory[];
  transports: Transport[];
  speed: number;
  turnSpeed: number;
  range: number;
  buildTime: number;
  strongVs?: string[] | Text | undefined;
  weakVs?: string[] | Text | undefined;
  draft: boolean;
  isNew: boolean;
  newUntil?: string | undefined;
  image?: string | undefined;
  miniIcon?: string | undefined;
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
  counts: { units: number; buildings: number; misc: number };
  wikiHref: string | null;
}

/* — сериализуемый индекс для острова — */

interface ExplorerWeapon {
  name: string;
  count: number;
  projectileCount?: number | undefined;
  projectileDelay?: number | undefined;
  damage: number;
  fireDelay: number;
  armourIgnoreAmount?: number | undefined;
  mainDps: boolean;
  dps: number;
  tags: string[];
  spread?: number | undefined;
  splashRadius?: number | undefined;
  stunDuration?: number | undefined;
}

interface ExplorerBuilder {
  buildRange: number;
  repairSpeed: number;
  buildSpeed: number;
  healTags: string[];
}

interface ExplorerFactory {
  name: string;
  buildSpeed: number;
  producedUnits: { id: string; name: string }[];
}

interface ExplorerTransport {
  name: string;
  seats: number;
  cargoTags: string[];
  unload: string[];
}

export interface ExplorerItem {
  id: string;
  tab: CardTab;
  faction: string;
  tags: string[];
  cost: number;
  energy: number;
  fullCost: number;
  hp: number;
  shield: number;
  armor: number;
  selfRegen: number;
  shieldRegen: number;
  dps: number;
  mainDps: number;
  weapons: ExplorerWeapon[];
  missileDefense?: ChargeDefense | undefined;
  torpedoDefense?: ChargeDefense | undefined;
  laserDefense?: DomeShield | undefined;
  domeShield?: DomeShield | undefined;
  atmosphere?: Atmosphere | undefined;
  ftlJump?: FtlJump | undefined;
  builder?: ExplorerBuilder | undefined;
  factories: ExplorerFactory[];
  transports: ExplorerTransport[];
  speed: number;
  turnSpeed: number;
  range: number;
  buildTime: number;
  /** Локализованные поля для полной карточки. */
  name: string;
  desc: string;
  role: string;
  strongVs: string[];
  weakVs: string[];
  factionName: string;
  factionColor: string;
  image: string | null;
  miniIcon: string | null;
  initials: string;
}

export interface ExplorerFaction {
  id: string;
  name: Text;
  color: string;
  counts: { units: number; buildings: number; misc: number };
  searchText: string;
}

export interface ExplorerTag {
  id: string;
  group: TagGroup;
  name: Text;
}

const DETAIL_LABEL_KEYS = {
  title: "database.detail.title",
  characteristics: "database.detail.characteristics",
  close: "database.detail.close",
  addCompare: "database.detail.addCompare",
  removeCompare: "database.detail.removeCompare",
  detailLabel: "database.detail",
  openUnit: "database.detail.openUnit",
  fullCost: "database.fullCost",
  cost: "database.cost",
  energy: "database.energy",
  buildTime: "database.buildTime",
  hp: "database.hp",
  shield: "database.shield",
  armor: "database.armor",
  selfRegen: "database.selfRegen",
  shieldRegen: "database.shieldRegen",
  speed: "database.speed",
  turnSpeed: "database.turnSpeed",
  range: "database.range",
  dpsMain: "database.dpsMain",
  dpsAll: "database.dpsAll",
  dpsPerFullCost: "database.compare.metric.dpsPerFullCost",
  totalHpPerFullCost: "database.compare.metric.totalHpPerFullCost",
  strong: "database.strong",
  weak: "database.weak",
  abilities: "database.abilities",
  abilityMissile: "database.ability.missile",
  abilityTorpedo: "database.ability.torpedo",
  abilityLaser: "database.ability.laser",
  abilityDome: "database.ability.dome",
  abilityAtmosphere: "database.ability.atmosphere",
  abilityFtl: "database.ability.ftl",
  ftlSiv: "database.ability.ftl.siv",
  ftlPlasma: "database.ability.ftl.plasma",
  ftlTele: "database.ability.ftl.tele",
  ftlSpeed: "database.ability.ftl.speed",
  ftlCharge: "database.ability.ftl.charge",
  ftlCooldown: "database.ability.ftl.cooldown",
  ftlMinDistance: "database.ability.ftl.minDistance",
  ftlEnergyCost: "database.ability.ftl.energyCost",
  ftlInstant: "database.ability.ftl.instant",
  ftlTagMove: "database.ability.ftl.tag.move",
  ftlTagBigVisible: "database.ability.ftl.tag.bigVisible",
  ftlTagAtmosphere: "database.ability.ftl.tag.atmosphere",
  ftlTagAlwaysVisible: "database.ability.ftl.tag.alwaysVisible",
  ftlTagGasRecharge: "database.ability.ftl.tag.gasRecharge",
  ftlTagStealth: "database.ability.ftl.tag.stealth",
  charges: "database.ability.charges",
  perSecond: "database.ability.perSecond",
  yes: "database.ability.yes",
  weapons: "database.weapons",
  noWeapons: "database.weapon.noWeapons",
  weaponName: "database.weapon.name",
  weaponCount: "database.weapon.count",
  weaponProjectiles: "database.weapon.projectiles",
  weaponProjectileDelay: "database.weapon.projectileDelay",
  weaponDamage: "database.weapon.damage",
  weaponFireDelay: "database.weapon.fireDelay",
  weaponArmourIgnore: "database.weapon.armourIgnore",
  weaponDps: "database.weapon.dps",
  weaponMain: "database.weapon.main",
  weaponTags: "database.weapon.tags",
  weaponSpread: "database.weapon.spread",
  weaponSplash: "database.weapon.splash",
  weaponStun: "database.weapon.stun",
  weaponOrder: "database.weapon.order",
  builder: "database.builder",
  builderBuildRange: "database.builder.buildRange",
  builderRepairSpeed: "database.builder.repairSpeed",
  builderBuildSpeed: "database.builder.buildSpeed",
  builderHeals: "database.builder.heals",
  factories: "database.factories",
  factorySpeed: "database.factory.speed",
  factoryUnits: "database.factory.units",
  transports: "database.transports",
  transportSeats: "database.transport.seats",
  transportCargo: "database.transport.cargo",
  transportUnload: "database.transport.unload",
  unloadShore: "database.unload.shore",
  unloadWater: "database.unload.water",
  unloadAir: "database.unload.air",
  unloadUnderwater: "database.unload.underwater",
  unloadSpace: "database.unload.space",
  seconds: "database.seconds",
  secondsShort: "database.secondsShort",
  secondsAtSpeed1: "database.secondsAtSpeed1",
  sortAsc: "database.sort.asc",
  sortDesc: "database.sort.desc",
  tagClear: "database.tag.clear",
  tagModeAll: "database.tag.mode.all",
  tagModeAny: "database.tag.mode.any",
} as const satisfies Record<string, DictKey>;

export type DetailLabels = { [K in keyof typeof DETAIL_LABEL_KEYS]: string };

export function detailLabels(lang: Lang): DetailLabels {
  return Object.fromEntries(
    Object.entries(DETAIL_LABEL_KEYS).map(([key, dictKey]) => [key, t(lang, dictKey)]),
  ) as DetailLabels;
}

export interface ExplorerLabels {
  detail: DetailLabels;
  search: string;
  clearSearch: string;
  all: string;
  faction: string;
  tag: string;
  weaponTag: string;
  sortLabel: string;
  sortAsc: string;
  sortDesc: string;
  resetFilters: string;
  dps: string;
  sort: Record<SortKey, string>;
  tagPanelTitle: string;
  weaponTagPanelTitle: string;
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
    tags: string;
    weaponSlot: string;
    weaponFilter: string;
    weaponFilterEmpty: string;
    builder: string;
    factories: string;
    transports: string;
    group: Record<CompareGroup, string>;
    metric: Record<CompareMetric, string>;
  };
}

interface ExplorerData {
  items: ExplorerItem[];
  factions: ExplorerFaction[];
  tags: ExplorerTag[];
  labels: ExplorerLabels;
}

interface DatabaseData {
  cards: DatabaseCard[];
  factions: DatabaseFaction[];
  /** Стартовая линейная шкала каждой вкладки; клиент пересчитывает её по фильтрам. */
  scales: Record<CardTab, StatScale>;
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

/** Дополнительная мини-иконка: без fallback, пустое значение скрывает её. */
export function resolveMiniIcon(image: string | undefined): string | null {
  if (!image) return null;
  return href(image.replace(/^assets\//, ""));
}

function safeColor(color: string | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : FALLBACK_COLOR;
}

function emblemFileName(emblem: string): string | null {
  const file = emblem.split("/").pop();
  return file && /\.svg$/i.test(file) ? file : null;
}

/* — полосы: линейная шкала по максимуму выборки — */

export function buildBars(card: DatabaseCard, lang: Lang, scale: StatScale): StatBarData[] {
  const bars: StatBarData[] = [];
  for (const key of STAT_KEYS) {
    const entry = scale[key];
    if (!entry) continue;
    const value = key === "dps" ? card.mainDps : card[key];
    const display =
      key === "dps" && card.dps !== card.mainDps
        ? `${formatStat(card.mainDps)} – ${formatStat(card.dps)}`
        : formatStat(value);
    bars.push({
      key,
      value,
      label: t(lang, `database.${key}`),
      display,
      percent: barPercent(value, entry.max),
      medianPercent: barPercent(entry.median, entry.max),
    });
  }
  return bars;
}

/* — сборка данных страницы — */

type CardData = Unit | Building | Misc;

function toCard(id: string, tab: CardTab, data: CardData): DatabaseCard {
  const derived = withDerivedCard(data);
  return {
    id,
    tab,
    faction: data.faction,
    tags: [...data.tags],
    name: data.name,
    desc: data.desc,
    role: data.role,
    cost: data.cost,
    energy: data.energy,
    fullCost: derived.fullCost,
    hp: data.hp,
    shield: data.shield ?? 0,
    armor: data.armor ?? 0,
    selfRegen: data.selfRegen ?? 0,
    shieldRegen: data.shieldRegen ?? 0,
    dps: derived.dps,
    mainDps: derived.mainDps,
    weapons: derived.weapons ?? [],
    missileDefense: data.missileDefense,
    torpedoDefense: data.torpedoDefense,
    laserDefense: data.laserDefense,
    domeShield: data.domeShield,
    atmosphere: data.atmosphere,
    tacticalInstallation: data.tacticalInstallation ?? false,
    nuclearInstallation: data.nuclearInstallation ?? false,
    hyperInstallation: data.hyperInstallation ?? false,
    tacticalMissileDefense: data.tacticalMissileDefense ?? false,
    nuclearMissileDefense: data.nuclearMissileDefense ?? false,
    hyperMissileDefense: data.hyperMissileDefense ?? false,
    ftlJump: data.ftlJump,
    builder: data.builder,
    factories: data.factories ?? [],
    transports: data.transports ?? [],
    speed: data.speed ?? 0,
    turnSpeed: data.turnSpeed ?? 0,
    range: data.range ?? 0,
    buildTime: data.buildTime,
    strongVs: data.strongVs,
    weakVs: data.weakVs,
    draft: data.draft ?? false,
    isNew: isBadgeNew(data.new, data.newUntil),
    newUntil: data.newUntil,
    image: data.image,
    miniIcon: data.miniIcon,
  };
}

/** Текст для клиентского поиска: карточка кладёт его в data-search. */
export function cardSearchText(
  card: DatabaseCard,
  lang: Lang,
  factions: Map<string, Faction>,
  tags: Map<string, Tag>,
): string {
  const name = card.name[lang];
  const tagText = [...new Set(card.tags.flatMap((id) => [id, tagLabel(tags, id, lang)]))].join(" ");
  const weaponText = card.weapons
    .map((weapon) => {
      const weaponTags = weapon.tags.map((id) => tagLabel(tags, id, lang)).join(" ");
      return `${weapon.name[lang]} ${weaponTags}`;
    })
    .join(" ");
  const jumpText = card.ftlJump
    ? [
        t(lang, "database.ability.ftl"),
        t(lang, FTL_TYPE_LABEL[card.ftlJump.type]),
        ...FTL_JUMP_TAGS[card.ftlJump.type].map((key) => t(lang, key)),
      ].join(" ")
    : "";
  const abilityText = [
    card.missileDefense ? t(lang, "database.ability.missile") : "",
    card.torpedoDefense ? t(lang, "database.ability.torpedo") : "",
    card.laserDefense ? t(lang, "database.ability.laser") : "",
    card.domeShield ? t(lang, "database.ability.dome") : "",
    card.atmosphere ? t(lang, "database.ability.atmosphere") : "",
    jumpText,
  ]
    .filter(Boolean)
    .join(" ");
  return foldSearch(
    `${name} ${factionName(factions, card.faction, lang)} ${card.role?.[lang] ?? ""} ${card.desc[lang]} ${tagText} ${weaponText} ${abilityText}`,
  );
}

function explorerLabels(lang: Lang): ExplorerLabels {
  return {
    detail: detailLabels(lang),
    search: t(lang, "database.search.placeholder"),
    clearSearch: t(lang, "database.search.clear"),
    all: t(lang, "database.filter.all"),
    faction: t(lang, "database.filter.faction"),
    tag: t(lang, "database.filter.tag"),
    weaponTag: t(lang, "database.filter.weaponTag"),
    sortLabel: t(lang, "database.sort.label"),
    sortAsc: t(lang, "database.sort.asc"),
    sortDesc: t(lang, "database.sort.desc"),
    resetFilters: t(lang, "database.filter.reset"),
    dps: t(lang, "database.dps"),
    sort: {
      name: t(lang, "database.sort.name"),
      fullCost: t(lang, "database.sort.fullCost"),
      buildTime: t(lang, "database.sort.buildTime"),
      hp: t(lang, "database.sort.hp"),
      shield: t(lang, "database.sort.shield"),
      armor: t(lang, "database.sort.armor"),
      dps: t(lang, "database.sort.dps"),
      speed: t(lang, "database.sort.speed"),
      range: t(lang, "database.sort.range"),
    },
    tagPanelTitle: t(lang, "database.tag.panelTitle"),
    weaponTagPanelTitle: t(lang, "database.weaponTag.panelTitle"),
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
      weapon: t(lang, "database.tagGroup.weapon"),
      sector: t(lang, "database.tagGroup.sector"),
    },
    count: t(lang, "database.count"),
    compare: {
      title: t(lang, "database.compare.title"),
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
      tags: t(lang, "database.compare.tags"),
      weaponSlot: t(lang, "database.compare.weaponSlot"),
      weaponFilter: t(lang, "database.compare.weaponFilter"),
      weaponFilterEmpty: t(lang, "database.compare.weaponFilterEmpty"),
      builder: t(lang, "database.compare.builder"),
      factories: t(lang, "database.compare.factories"),
      transports: t(lang, "database.compare.transports"),
      group: {
        identity: t(lang, "database.compare.group.identity"),
        cost: t(lang, "database.compare.group.cost"),
        survival: t(lang, "database.compare.group.survival"),
        offense: t(lang, "database.compare.group.offense"),
        weapons: t(lang, "database.compare.group.weapons"),
        mobility: t(lang, "database.compare.group.mobility"),
        efficiency: t(lang, "database.compare.group.efficiency"),
      },
      metric: {
        cost: t(lang, "database.compare.metric.cost"),
        energy: t(lang, "database.compare.metric.energy"),
        fullCost: t(lang, "database.compare.metric.fullCost"),
        buildTime: t(lang, "database.compare.metric.buildTime"),
        hp: t(lang, "database.compare.metric.hp"),
        shield: t(lang, "database.compare.metric.shield"),
        armor: t(lang, "database.compare.metric.armor"),
        selfRegen: t(lang, "database.compare.metric.selfRegen"),
        shieldRegen: t(lang, "database.compare.metric.shieldRegen"),
        totalHp: t(lang, "database.compare.metric.totalHp"),
        dps: t(lang, "database.compare.metric.dps"),
        dpsAll: t(lang, "database.compare.metric.dpsAll"),
        range: t(lang, "database.compare.metric.range"),
        speed: t(lang, "database.compare.metric.speed"),
        turnSpeed: t(lang, "database.compare.metric.turnSpeed"),
        dpsPerFullCost: t(lang, "database.compare.metric.dpsPerFullCost"),
        totalHpPerFullCost: t(lang, "database.compare.metric.totalHpPerFullCost"),
      },
    },
  };
}

/** Полный набор данных страницы для языка. Только сервер: содержит Map. */
export async function loadDatabase(lang: Lang): Promise<DatabaseData> {
  const [unitEntries, buildingEntries, miscEntries, factionEntries, tagEntries, published] =
    await Promise.all([
      getCollection("units"),
      getCollection("buildings"),
      getCollection("misc"),
      getCollection("factions"),
      getCollection("tags"),
      getPublished(lang),
    ]);

  // Порядок фракций задаётся полем order: сначала Фенземская Республика и
  // Движение Протон, затем остальные (см. src/data/factions.json).
  const sortedFactions = factionEntries.toSorted((a, b) => a.data.order - b.data.order);

  const tagMap = new Map(tagEntries.map((entry) => [entry.id, entry.data]));
  const factionMap = new Map(factionEntries.map((entry) => [entry.id, entry.data]));

  const counts = new Map<string, { units: number; buildings: number; misc: number }>();
  for (const entry of factionEntries) {
    counts.set(entry.id, { units: 0, buildings: 0, misc: 0 });
  }

  const cards: DatabaseCard[] = [
    ...unitEntries.map((entry) => toCard(entry.id, "units", entry.data)),
    ...buildingEntries.map((entry) => toCard(entry.id, "buildings", entry.data)),
    ...miscEntries.map((entry) => toCard(entry.id, "misc", entry.data)),
  ];
  for (const card of cards) {
    const counter = counts.get(card.faction);
    if (counter) counter[card.tab] += 1;
  }

  const cardsByTab: Record<CardTab, DatabaseCard[]> = { units: [], buildings: [], misc: [] };
  for (const card of cards) cardsByTab[card.tab].push(card);
  const scales: Record<CardTab, StatScale> = {
    units: computeStatScale(cardsByTab.units),
    buildings: computeStatScale(cardsByTab.buildings),
    misc: computeStatScale(cardsByTab.misc),
  };

  const publishedSlugs = new Set(published.map((entry) => entrySlug(entry)));
  const factions: DatabaseFaction[] = sortedFactions.map((entry) => {
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
      counts: counts.get(entry.id) ?? { units: 0, buildings: 0, misc: 0 },
      wikiHref: hasWiki ? localeHref(lang, `wiki/${data.lore}/`) : null,
    };
  });

  const items: ExplorerItem[] = cards.map((card) => {
    const name = card.name[lang];
    return {
      id: card.id,
      tab: card.tab,
      faction: card.faction,
      tags: card.tags,
      cost: card.cost,
      energy: card.energy,
      fullCost: card.fullCost,
      hp: card.hp,
      shield: card.shield,
      armor: card.armor,
      selfRegen: card.selfRegen,
      shieldRegen: card.shieldRegen,
      dps: card.dps,
      mainDps: card.mainDps,
      weapons: card.weapons.map((weapon) => ({
        name: weapon.name[lang],
        count: weapon.count,
        projectileCount: weapon.projectileCount,
        projectileDelay: weapon.projectileDelay,
        damage: weapon.damage,
        fireDelay: weapon.fireDelay,
        armourIgnoreAmount: weapon.armourIgnoreAmount,
        mainDps: weapon.mainDps,
        dps: weaponDps(weapon),
        tags: [...weapon.tags],
        spread: weapon.spread,
        splashRadius: weapon.splashRadius,
        stunDuration: weapon.stunDuration,
      })),
      missileDefense: card.missileDefense,
      torpedoDefense: card.torpedoDefense,
      laserDefense: card.laserDefense,
      domeShield: card.domeShield,
      atmosphere: card.atmosphere,
      ftlJump: card.ftlJump,
      builder: card.builder
        ? {
            buildRange: card.builder.buildRange,
            repairSpeed: card.builder.repairSpeed,
            buildSpeed: card.builder.buildSpeed,
            healTags: [...card.builder.healTags],
          }
        : undefined,
      factories: card.factories.map((factory) => ({
        name: factory.name[lang],
        buildSpeed: factory.buildSpeed,
        producedUnits: factory.producedUnits.map((id) => ({
          id,
          name: cards.find((entry) => entry.id === id)?.name[lang] ?? id,
        })),
      })),
      transports: card.transports.map((transport) => ({
        name: transport.name[lang],
        seats: transport.seats,
        cargoTags: [...transport.cargoTags],
        unload: [...transport.unload],
      })),
      speed: card.speed,
      turnSpeed: card.turnSpeed,
      range: card.range,
      buildTime: card.buildTime,
      name,
      desc: card.desc[lang],
      role: card.role?.[lang] ?? "",
      strongVs: pickList(card.strongVs, lang),
      weakVs: pickList(card.weakVs, lang),
      factionName: factionName(factionMap, card.faction, lang),
      factionColor: factionColor(factionMap, card.faction),
      image: resolveImage(card.image, card.id),
      miniIcon: resolveMiniIcon(card.miniIcon),
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

  return {
    cards,
    factions,
    scales,
    factionMap,
    tagMap,
    explorer: {
      items,
      factions: explorerFactions,
      tags: tagEntries.map((entry) => ({
        id: entry.id,
        group: entry.data.group,
        name: entry.data.name,
      })),
      labels: explorerLabels(lang),
    },
  };
}
