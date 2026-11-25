/* ============================================================================
   WWN — импорт данных мода в JSON-коллекции сайта.
   Запуск:
     node scripts/import-mod/index.ts            # dry-run, отчёт
     node scripts/import-mod/index.ts --write    # запись JSON
   ============================================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type BuildContext, buildCard, type CardBuildResult, type CardPatch } from "./extract.ts";
import { buildMaps, writeMaps } from "./maps.ts";
import {
  discoverCards,
  discoverManualCards,
  MOD_ROOT,
  normalizedSourceName,
  SITE_ROOT,
  type SourceCard,
  siteIdForSourceName,
} from "./source.ts";

const WRITE = process.argv.includes("--write");

type Json = Record<string, unknown>;

interface Card extends Json {
  id: string;
  name: { ru: string; en: string };
  faction: string;
  desc: { ru: string; en: string };
  tags: string[];
  cost: number;
  energy: number;
  hp: number;
  buildTime: number;
  image?: string;
}

function keyOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const tagsFile = path.join(SITE_ROOT, "src/data/tags.json");
const unitsFile = path.join(SITE_ROOT, "src/data/units.json");
const buildingsFile = path.join(SITE_ROOT, "src/data/buildings.json");
const factionsFile = path.join(SITE_ROOT, "src/data/factions.json");

const tagsData = readJson<{
  _schema?: string[];
  tags: Array<{ id: string; name: { ru: string; en: string }; group: string }>;
}>(tagsFile);
const unitsData = readJson<{ _schema?: string[]; units: Card[] }>(unitsFile);
const buildingsData = readJson<{ _schema?: string[]; buildings: Card[] }>(buildingsFile);
const factionsData = readJson<{ _comment?: string; factions: Array<Json> }>(factionsFile);

const factionDescriptions: Record<
  string,
  {
    desc: { ru: string; en: string };
    playstyle?: { ru: string; en: string };
    specialty?: { ru: string; en: string };
  }
> = {
  darkmarket: {
    desc: {
      ru: "Теневой синдикат, живущий контрабандой, наёмниками и трофейными технологиями. Войска — сборная солянка из дешёвых клонов, переделанной техники и туннельных укрытий.",
      en: "A shadow syndicate living on smuggling, mercenaries and salvaged technology. Its forces are a patchwork of cheap clones, converted hardware and tunnel hideouts.",
    },
    playstyle: {
      ru: "Дешёвая пехота, туннели и неожиданные удары.",
      en: "Cheap infantry, tunnels and surprise strikes.",
    },
    specialty: {
      ru: "Наёмники и трофейная техника",
      en: "Mercenaries and salvaged hardware",
    },
  },
  bioforms: {
    desc: {
      ru: "Дикая биосфера планеты: стаи хищников, растения-ловушки и ханхонханы. Не строят заводов — растут, охотятся и размножаются.",
      en: "The planet's wild biosphere: packs of predators, trap plants and the Hanhonhans. They do not build factories — they grow, hunt and multiply.",
    },
    playstyle: {
      ru: "Живая масса, регенерация и давление числом.",
      en: "Living mass, regeneration and pressure in numbers.",
    },
    specialty: {
      ru: "Хищники и биологические ловушки",
      en: "Predators and biological traps",
    },
  },
  aborigines: {
    desc: {
      ru: "Коренные племена Фензема. Примитивное, но опасное оружие: копья с энергокристаллами, пращи, баллисты и святилища.",
      en: "The native tribes of Fenearth. Primitive but dangerous weapons: energy-crystal spears, slings, ballistae and sanctuaries.",
    },
    playstyle: {
      ru: "Раннее давление, дешёвые отряды и стан.",
      en: "Early pressure, cheap squads and stun.",
    },
    specialty: {
      ru: "Копейщики и стан-оружие",
      en: "Spearmen and stun weapons",
    },
  },
  neutrals: {
    desc: {
      ru: "Гражданские и нейтральные объекты: машины, автобусы, мастерские, щиты и температурные вышки. Не воюют, но могут стать укрытием или добычей.",
      en: "Civilian and neutral objects: cars, buses, workshops, shields and temperature towers. They do not fight, but can become cover or loot.",
    },
    playstyle: {
      ru: "Мирные объекты и укрытия.",
      en: "Civilian objects and cover.",
    },
    specialty: {
      ru: "Гражданская инфраструктура",
      en: "Civilian infrastructure",
    },
  },
};

for (const faction of factionsData.factions) {
  const id = typeof faction.id === "string" ? faction.id : "";
  const update = factionDescriptions[id];
  if (!update) continue;
  faction.desc = update.desc;
  if (update.playstyle) faction.playstyle = update.playstyle;
  if (update.specialty) faction.specialty = update.specialty;
}

const newTags = [
  { id: "beast", name: { ru: "Зверь", en: "Beast" }, group: "class" },
  { id: "plant", name: { ru: "Растение", en: "Plant" }, group: "class" },
  { id: "civilian", name: { ru: "Гражданский", en: "Civilian" }, group: "class" },
  { id: "aborigines", name: { ru: "Аборигены", en: "Aborigines" }, group: "mod" },
  { id: "bmarket", name: { ru: "Чёрный рынок", en: "Dark Market" }, group: "mod" },
  { id: "han", name: { ru: "Ханхонханы", en: "Hanhonhans" }, group: "mod" },
  { id: "tunnel", name: { ru: "Туннель", en: "Tunnel" }, group: "mod" },
  { id: "trap", name: { ru: "Ловушка", en: "Trap" }, group: "mod" },
  { id: "wall", name: { ru: "Стена", en: "Wall" }, group: "mod" },
  { id: "bridge", name: { ru: "Мост", en: "Bridge" }, group: "mod" },
  { id: "weather", name: { ru: "Погода", en: "Weather" }, group: "mod" },
];

for (const tag of newTags) {
  if (!tagsData.tags.some((entry) => entry.id === tag.id)) tagsData.tags.push(tag);
}

const tagMap = new Map(tagsData.tags.map((tag) => [tag.id, { id: tag.id, group: tag.group }]));
const tagAliases = new Map<string, string>([
  ["aborigens", "aborigines"],
  ["beast", "beast"],
  ["plant", "plant"],
  ["bmarket", "bmarket"],
  ["han", "han"],
  ["civil", "civilian"],
  ["trap", "trap"],
  ["wall", "wall"],
  ["bridge", "bridge"],
  ["weather", "weather"],
]);

const existingCards = [...unitsData.units, ...buildingsData.buildings];
const existingById = new Map(existingCards.map((card) => [card.id, card]));
const unitIds = new Set(unitsData.units.map((card) => card.id));

const sourceCards = [...discoverCards(), ...discoverManualCards()];
const sourceByKey = new Map<string, SourceCard>();
for (const card of sourceCards) {
  const key = keyOf(card.sourceName);
  if (!sourceByKey.has(key)) sourceByKey.set(key, card);
}

const sourceToId = new Map<string, string>();
for (const card of existingCards) sourceToId.set(normalizedSourceName(card.id), card.id);
for (const card of sourceCards) {
  const key = keyOf(card.sourceName);
  const existing = existingCards.find((entry) => keyOf(entry.id) === key);
  if (existing) sourceToId.set(normalizedSourceName(card.sourceName), existing.id);
}
sourceToId.set("suppe2", "suppe2");
sourceToId.set("proton", "protonhq");
sourceToId.set("fzhq", "fenearthq");
sourceToId.set("stratring", "taktring");
sourceToId.set("taktring", "taktring");
sourceToId.set("sorpariza", "sorpariz");
sourceToId.set("detraidera", "detraider");
sourceToId.set("sorpariz", "sorpariz");
sourceToId.set("detraider", "detraider");

// Новые карточки должны быть доступны заводам ещё до записи.
const plannedUnitIds = new Set(unitIds);
for (const card of sourceCards) {
  if (card.variant) continue;
  const key = normalizedSourceName(card.sourceName);
  const known =
    existingCards.some((entry) => keyOf(entry.id) === keyOf(card.sourceName)) ||
    sourceToId.has(key);
  const id = sourceToId.get(key) ?? siteIdForSourceName(card.sourceName);
  if (!sourceToId.has(key)) sourceToId.set(key, id);
  if (!known && !card.isBuilding) plannedUnitIds.add(id);
}
for (const id of sourceToId.values()) {
  if (
    !plannedUnitIds.has(id) &&
    existingCards.some((entry) => entry.id === id && unitIds.has(id))
  ) {
    plannedUnitIds.add(id);
  }
}

const ctx: BuildContext = {
  tags: tagMap,
  sourceToId,
  unitIds: plannedUnitIds,
  tagAliases,
};

const manualExisting: Record<string, string> = {
  "tmd-p": "tmd_P",
  "turret-t1": "turret_t1",
  "turret-t3": "turret_t3",
  "turret-t1p": "turret_t1P",
  suppe2: "supPE2",
  protonhq: "Proton",
  fenearthq: "FZHQ",
  taktring: "Taktring",
};

const usedSources = new Set<string>();
const updates: Array<{ tab: "units" | "buildings"; id: string; card: Card; source: string }> = [];
const unresolved: string[] = [];

function mergeExisting(existing: Card, patch: CardPatch): Card {
  const merged: Json = { ...existing };
  merged.tags = patch.tags ?? existing.tags;
  if (patch.cost !== undefined && (patch.cost > 0 || existing.cost === 0)) merged.cost = patch.cost;
  if (patch.energy !== undefined) merged.energy = patch.energy;
  if (patch.hp !== undefined && (patch.hp > 0 || existing.hp === 0)) merged.hp = patch.hp;
  if (patch.armor !== undefined) merged.armor = patch.armor;
  if (patch.shield !== undefined && patch.shield > 0) merged.shield = patch.shield;
  if (patch.shieldRegen !== undefined) merged.shieldRegen = patch.shieldRegen;
  if (patch.selfRegen !== undefined) merged.selfRegen = patch.selfRegen;
  if (patch.speed !== undefined) merged.speed = patch.speed;
  if (patch.turnSpeed !== undefined) merged.turnSpeed = patch.turnSpeed;
  if (patch.range !== undefined) merged.range = patch.range;
  if (patch.buildTime !== undefined && (patch.buildTime > 0 || existing.buildTime === 0)) {
    merged.buildTime = patch.buildTime;
  }
  if (patch.weapons && patch.weapons.length > 0) merged.weapons = patch.weapons;
  for (const key of [
    "missileDefense",
    "torpedoDefense",
    "laserDefense",
    "domeShield",
    "atmosphere",
    "ftlJump",
    "builder",
    "factories",
    "transports",
  ] as const) {
    if (patch[key] !== undefined) merged[key] = patch[key];
  }
  return merged as Card;
}

function newCard(result: CardBuildResult): Card {
  const patch = result.card;
  const card: Json = {
    id: result.id,
    name: patch.name ?? { ru: result.sourceName, en: result.sourceName },
    faction: patch.faction ?? "neutrals",
    desc: patch.desc ?? { ru: result.sourceName, en: result.sourceName },
    tags: patch.tags ?? [],
    cost: patch.cost ?? 0,
    energy: patch.energy ?? 0,
    hp: patch.hp ?? 0,
  };
  for (const key of [
    "shield",
    "armor",
    "selfRegen",
    "shieldRegen",
    "speed",
    "turnSpeed",
    "range",
  ] as const) {
    if (patch[key] !== undefined) card[key] = patch[key];
  }
  card.buildTime = patch.buildTime ?? 0;
  if (patch.weapons && patch.weapons.length > 0) card.weapons = patch.weapons;
  for (const key of [
    "missileDefense",
    "torpedoDefense",
    "laserDefense",
    "domeShield",
    "atmosphere",
    "ftlJump",
    "builder",
    "factories",
    "transports",
  ] as const) {
    if (patch[key] !== undefined) card[key] = patch[key];
  }
  card.image = "";
  return card as Card;
}

function defaultClassFor(source: SourceCard): string | undefined {
  const folder = source.folder.toLowerCase();
  if (folder.includes("/fauna/") || folder.includes("/hanhonhans/")) return "beast";
  if (folder.includes("/flora/")) return "plant";
  return undefined;
}

for (const existing of existingCards) {
  const sourceName = manualExisting[existing.id] ?? existing.id;
  const source = sourceByKey.get(keyOf(sourceName));
  if (!source) {
    console.warn(`нет источника для существующей карточки: ${existing.id}`);
    continue;
  }
  usedSources.add(source.key);
  const result = buildCard(
    source,
    ctx,
    { id: existing.id, tags: existing.tags },
    defaultClassFor(source),
  );
  if (result.unresolved.length > 0)
    unresolved.push(...result.unresolved.map((entry) => `${existing.id}: ${entry}`));
  const card = mergeExisting(existing, result.card);
  updates.push({
    tab: unitIds.has(existing.id) ? "units" : "buildings",
    id: existing.id,
    card,
    source: source.sourceName,
  });
}

const additions: Array<{ tab: "units" | "buildings"; card: Card; source: SourceCard }> = [];
for (const source of sourceCards) {
  if (usedSources.has(source.key) || source.variant) continue;
  if (source.faction === "fenearth" || source.faction === "proton") {
    if (source.sourceName !== "AorbPE") continue;
  }
  const result = buildCard(source, ctx, undefined, defaultClassFor(source));
  if (result.unresolved.length > 0)
    unresolved.push(...result.unresolved.map((entry) => `${result.id}: ${entry}`));
  const card = newCard(result);
  if (existingById.has(card.id) || additions.some((entry) => entry.card.id === card.id)) {
    console.warn(`пропуск дубля id: ${card.id} (${source.sourceName})`);
    continue;
  }
  additions.push({ tab: result.isBuilding ? "buildings" : "units", card, source });
}

const updatedUnits = unitsData.units.map(
  (card) => updates.find((entry) => entry.id === card.id)?.card ?? card,
);
const updatedBuildings = buildingsData.buildings.map(
  (card) => updates.find((entry) => entry.id === card.id)?.card ?? card,
);
for (const addition of additions) {
  if (addition.tab === "units") updatedUnits.push(addition.card);
  else updatedBuildings.push(addition.card);
}

const byFaction = (card: Card): string => card.faction;
const additionsReport = additions.reduce<Record<string, number>>((acc, entry) => {
  const key = `${entry.tab}/${byFaction(entry.card)}`;
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
for (const addition of additions) {
  console.log(
    `  + ${addition.tab}/${addition.card.id} — ${addition.card.name.ru} (${addition.source.sourceName})`,
  );
}

const weaponCount = [
  ...updates.map((entry) => entry.card),
  ...additions.map((entry) => entry.card),
].filter(
  (card) =>
    Array.isArray((card as Json).weapons) && ((card as Json).weapons as unknown[]).length > 0,
).length;
const armorCount = [...updatedUnits, ...updatedBuildings].filter(
  (card) => (card as Json).armor !== undefined,
).length;
const energyCount = [...updatedUnits, ...updatedBuildings].filter(
  (card) => ((card as Json).energy as number) > 0,
).length;

const maps = await buildMaps(WRITE);

console.log(`Источник: ${MOD_ROOT}`);
console.log(`Найдено UDS-карточек: ${sourceCards.length}`);
console.log(`Обновлено существующих: ${updates.length}`);
console.log(`Добавлено новых: ${additions.length}`, additionsReport);
console.log(`Карточек с оружием: ${weaponCount}`);
console.log(`Карточек с бронёй: ${armorCount}`);
console.log(`Карточек с энергией > 0: ${energyCount}`);
console.log(`Карт: ${maps.length}`);
if (unresolved.length > 0) {
  console.log(`Неразрешённых ссылок: ${unresolved.length}`);
  for (const entry of unresolved.slice(0, 20)) console.log(`  ! ${entry}`);
}

if (!WRITE) {
  console.log("\nDry-run. Для записи добавьте --write.");
  if (process.argv.includes("--dump-new")) {
    for (const addition of additions) console.log(JSON.stringify(addition.card));
  }
  const samples = ["tankt1fzr", "akula", "airfzr", "armcld", "lasdef", "spear", "killers"];
  for (const sample of samples) {
    const card = [...updatedUnits, ...updatedBuildings].find((entry) => entry.id === sample);
    if (card) console.log(`\n--- ${sample} ---\n${JSON.stringify(card, null, 2)}`);
  }
} else {
  writeJson(tagsFile, tagsData);
  writeJson(unitsFile, { ...unitsData, units: updatedUnits });
  writeJson(buildingsFile, { ...buildingsData, buildings: updatedBuildings });
  writeJson(factionsFile, factionsData);
  writeMaps(maps);
  console.log("Записано: tags.json, units.json, buildings.json, factions.json, maps.json");
}
