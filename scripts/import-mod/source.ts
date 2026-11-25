/* ============================================================================
   WWN — импорт данных мода: поиск исходных карточек.
   ============================================================================ */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  clearMergeCache,
  last,
  loadMerged,
  type MergedIni,
  parseBool,
  resolveValue,
  splitList,
  values,
} from "./ini.ts";

export type ImportFaction =
  | "fenearth"
  | "proton"
  | "aborigines"
  | "darkmarket"
  | "bioforms"
  | "neutrals";

export interface SourceCard {
  key: string;
  sourceName: string;
  faction: ImportFaction;
  isBuilding: boolean;
  udsFile: string;
  unitFile: string;
  merged: MergedIni;
  folder: string;
  variant: boolean;
}

const SITE_ROOT = path.resolve(import.meta.dirname, "../..");
const MOD_ROOT = process.env.WWN_MOD_DIR ?? path.resolve(SITE_ROOT, "../WWN");

export { MOD_ROOT, SITE_ROOT };

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function factionFor(file: string): ImportFaction {
  const relative = path.relative(MOD_ROOT, file).split(path.sep);
  const top = relative[0];
  if (top === "PE") return "proton";
  if (top === "FER") return "fenearth";
  const group = relative[1] ?? "";
  if (group === "Aborigines") return "aborigines";
  if (group === "Illegal market") return "darkmarket";
  if (group === "Fauna" || group === "Flora" || group === "Hanhonhans") return "bioforms";
  if (group === "Civil") return "neutrals";
  return "neutrals";
}

function udsUnitFile(udsFile: string): string {
  const dir = path.dirname(udsFile);
  const base = path.basename(udsFile, path.extname(udsFile));
  const suffix = base.replace(/^UDS/i, "") || "1";
  const candidates = [
    path.join(dir, `Unit${suffix}.ini`),
    path.join(dir, `unit${suffix}.ini`),
    path.join(dir, `Buil${suffix}.ini`),
    path.join(dir, `buil${suffix}.ini`),
    path.join(dir, "Buil.ini"),
    path.join(dir, "buil.ini"),
    path.join(dir, "Unit.ini"),
    path.join(dir, "unit.ini"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const folderKey = path
    .basename(dir)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const files = readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".ini"))
    .map((file) => path.join(dir, file))
    .filter((file) => {
      const name = path.basename(file).toLowerCase();
      return !/^(nest|den|seeds?|wrek|dead|bul|gorb|uran)\b/.test(name);
    });

  let best: { file: string; score: number } | undefined;
  for (const file of files) {
    const name = path
      .basename(file, path.extname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    let score = 0;
    if (name === folderKey) score = 10;
    else if (name.startsWith(folderKey) && name.length <= folderKey.length + 4) score = 8;
    else if (name === "unit" || name.startsWith("unit")) score = 3;
    else score = 1;
    if (!best || score > best.score) best = { file, score };
  }
  return best?.file ?? udsFile;
}

function coreText(merged: MergedIni, key: string): string | undefined {
  const value = last(merged, "core", key);
  return value === undefined ? undefined : resolveValue(merged, value);
}

function coreBool(merged: MergedIni, key: string): boolean {
  return parseBool(coreText(merged, key), false);
}

function coreTags(merged: MergedIni): string[] {
  const tags: string[] = [];
  for (const line of values(merged, "core", "tags")) {
    for (const tag of splitList(resolveValue(merged, line))) tags.push(tag);
  }
  return tags;
}

export function detectBuilding(merged: MergedIni): boolean {
  if (coreBool(merged, "isbuilding")) return true;
  const movement = (last(merged, "movement", "movementtype") ?? "").trim().toUpperCase();
  if (movement === "BUILDING") return true;
  if (last(merged, "core", "footprint") !== undefined) return true;
  if (last(merged, "core", "constructionfootprint") !== undefined) return true;
  const tags = coreTags(merged).map((tag) => tag.toLowerCase());
  const looksBuildable = tags.includes("building") || tags.includes("building+");
  const mobile = tags.some((tag) =>
    ["transportable", "transportablesol", "desant", "nav", "air", "land", "hover"].some((word) =>
      tag.includes(word),
    ),
  );
  return looksBuildable && !mobile;
}

export function sourceName(merged: MergedIni): string | undefined {
  return merged.globals.get("name") ?? coreText(merged, "name");
}

export function displayName(merged: MergedIni): { ru: string; en: string } | undefined {
  const ru = coreText(merged, "displaytext_ru");
  const en = coreText(merged, "displaytext");
  if (!ru && !en) return undefined;
  return {
    ru: ru || en || "",
    en: en || ru || "",
  };
}

export function displayDescription(merged: MergedIni): { ru: string; en: string } | undefined {
  const ru = coreText(merged, "displaydescription_ru");
  const en = coreText(merged, "displaydescription");
  if (!ru && !en) return undefined;
  return {
    ru: ru || en || "",
    en: en || ru || "",
  };
}

export function discoverCards(): SourceCard[] {
  clearMergeCache();
  const roots = ["FER", "PE", "PLANETARY_TOOLS"].map((name) => path.join(MOD_ROOT, name));
  const files = roots
    .flatMap((root) => walk(root))
    .filter((file) => /(^|[/\\])UDS[^/\\]*\.template$/i.test(file));
  const cards: SourceCard[] = [];
  for (const udsFile of files.sort((a, b) => a.localeCompare(b))) {
    const merged = loadMerged(udsFile, MOD_ROOT);
    const name = sourceName(merged);
    if (!name) continue;
    const unitFile = udsUnitFile(udsFile);
    const combined = loadMerged(unitFile, MOD_ROOT);
    const isBuilding = detectBuilding(combined);
    const folder = path.relative(MOD_ROOT, path.dirname(udsFile)).split(path.sep).join("/");
    cards.push({
      key: `${folder}/${path.basename(udsFile)}`,
      sourceName: name,
      faction: factionFor(udsFile),
      isBuilding,
      udsFile,
      unitFile,
      merged: combined,
      folder,
      variant: name.startsWith("0"),
    });
  }
  return cards;
}

export const manualSources: Array<{
  sourceName: string;
  faction: ImportFaction;
  isBuilding: boolean;
  unitFile: string;
  siteId?: string;
}> = [
  {
    sourceName: "supPE2",
    faction: "proton",
    isBuilding: true,
    unitFile: path.join(MOD_ROOT, "PE/buildings/Supply/Supply_T2.ini"),
    siteId: "suppe2",
  },
  {
    sourceName: "Proton",
    faction: "proton",
    isBuilding: true,
    unitFile: path.join(MOD_ROOT, "PE/buildings/hq/Proton_hq.ini"),
    siteId: "protonhq",
  },
  {
    sourceName: "FZHQ",
    faction: "fenearth",
    isBuilding: true,
    unitFile: path.join(MOD_ROOT, "FER/buildings/hq/FZR_hq.ini"),
    siteId: "fenearthq",
  },
  {
    sourceName: "Taktring",
    faction: "proton",
    isBuilding: false,
    unitFile: path.join(MOD_ROOT, "PE/Units/TaktRing/TaktRingSP.ini"),
    siteId: "taktring",
  },
];

export function discoverManualCards(): SourceCard[] {
  const cards: SourceCard[] = [];
  for (const source of manualSources) {
    if (!existsSync(source.unitFile)) continue;
    const merged = loadMerged(source.unitFile, MOD_ROOT);
    cards.push({
      key: `manual/${path.basename(source.unitFile)}`,
      sourceName: source.sourceName,
      faction: source.faction,
      isBuilding: source.isBuilding,
      udsFile: source.unitFile,
      unitFile: source.unitFile,
      merged,
      folder: path.relative(MOD_ROOT, path.dirname(source.unitFile)).split(path.sep).join("/"),
      variant: false,
    });
  }
  return cards;
}

export function normalizedSourceName(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, "");
}

export function siteIdForSourceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
