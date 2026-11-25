/* ============================================================================
   WWN — импорт данных мода: извлечение статов, оружия и способностей.
   ============================================================================ */

import {
  type IniSection,
  last,
  type MergedIni,
  parseBool,
  parseNumber,
  parseSeconds,
  parseTicks,
  resolveValue,
  splitList,
  values,
} from "./ini.ts";
import {
  detectBuilding,
  displayDescription,
  displayName,
  type ImportFaction,
  normalizedSourceName,
  type SourceCard,
  siteIdForSourceName,
} from "./source.ts";

export interface Text {
  ru: string;
  en: string;
}

export interface WeaponData {
  name: Text;
  count: number;
  projectileCount: number;
  projectileDelay: number;
  damage: number;
  fireDelay: number;
  mainDps: boolean;
  armourIgnoreAmount?: number;
  tags: string[];
  spread?: number;
  splashRadius?: number;
  stunDuration?: number;
}

export interface CardPatch {
  name?: Text;
  desc?: Text;
  faction?: ImportFaction;
  tags?: string[];
  cost?: number;
  energy?: number;
  hp?: number;
  shield?: number;
  armor?: number;
  selfRegen?: number;
  shieldRegen?: number;
  speed?: number;
  turnSpeed?: number;
  range?: number;
  buildTime?: number;
  weapons?: WeaponData[];
  missileDefense?: { max: number; recharge: number };
  torpedoDefense?: { max: number; recharge: number };
  laserDefense?: { radius: number; points: number; regen: number };
  domeShield?: { radius: number; points: number; regen: number };
  atmosphere?: { time: number };
  ftlJump?: {
    type: "siv" | "plasma" | "tele";
    chargeTime: number;
    cooldown: number;
    minDistance: number;
    jumpSpeed?: number;
    energyCost?: number;
  };
  builder?: { buildRange: number; repairSpeed: number; buildSpeed: number; healTags: string[] };
  factories?: Array<{ name: Text; buildSpeed: number; producedUnits: string[] }>;
  transports?: Array<{ name: Text; seats: number; cargoTags: string[]; unload: string[] }>;
}

export interface CardBuildResult {
  card: CardPatch;
  sourceName: string;
  isBuilding: boolean;
  id: string;
  variant: boolean;
  unresolved: string[];
}

interface TagInfo {
  id: string;
  group: string;
}

export interface BuildContext {
  tags: Map<string, TagInfo>;
  sourceToId: Map<string, string>;
  unitIds: Set<string>;
  tagAliases?: Map<string, string>;
}

function entryValues(entries: Array<[string, string]>, key: string): string[] {
  const lower = key.toLowerCase();
  return entries.filter(([k]) => k === lower).map(([, v]) => v);
}

function entryLast(entries: Array<[string, string]>, key: string): string | undefined {
  const all = entryValues(entries, key);
  return all.length > 0 ? all[all.length - 1] : undefined;
}

function getSection(merged: MergedIni, name: string): IniSection | undefined {
  return merged.sections.get(name.toLowerCase());
}

function expandEntries(
  merged: MergedIni,
  name: string,
  prefix: string,
  stack: string[] = [],
): Array<[string, string]> {
  const target = getSection(merged, name);
  if (!target || stack.includes(name.toLowerCase())) return [];
  const nextStack = [...stack, name.toLowerCase()];
  const result: Array<[string, string]> = [];

  for (const value of entryValues(target.entries, "@copyfromsection")) {
    for (const ref of splitList(value)) {
      const refName = ref.includes("_") ? ref : `${prefix}_${ref}`;
      result.push(...expandEntries(merged, refName, prefix, nextStack));
    }
  }

  for (const value of entryValues(target.entries, "copyfrom")) {
    for (const ref of splitList(value)) {
      if (ref.startsWith("${")) continue;
      const exact = getSection(merged, ref);
      const candidate = exact ? ref : `${prefix}_${ref}`;
      result.push(...expandEntries(merged, candidate, prefix, nextStack));
    }
  }

  result.push(
    ...target.entries.filter(([key]) => key !== "copyfrom" && key !== "@copyfromsection"),
  );
  return result;
}

function fieldValue(
  merged: MergedIni,
  sectionName: string,
  entries: Array<[string, string]>,
  key: string,
  fallback = "",
): string | undefined {
  const raw =
    entryLast(entries, key) ?? last(merged, sectionName, key) ?? last(merged, fallback, key);
  return raw === undefined ? undefined : resolveValue(merged, raw);
}

function numberValue(
  merged: MergedIni,
  sectionName: string,
  entries: Array<[string, string]>,
  key: string,
  fallback = "",
): number | undefined {
  return parseNumber(fieldValue(merged, sectionName, entries, key, fallback));
}

function boolValue(
  merged: MergedIni,
  sectionName: string,
  entries: Array<[string, string]>,
  key: string,
  fallback = "",
): boolean {
  return parseBool(fieldValue(merged, sectionName, entries, key, fallback), false);
}

function globalNumber(merged: MergedIni, key: string): number | undefined {
  const value = merged.globals.get(key.toLowerCase());
  return value === undefined ? undefined : parseNumber(resolveValue(merged, value));
}

function coreNumber(merged: MergedIni, key: string): number | undefined {
  return parseNumber(
    last(merged, "core", key) ? resolveValue(merged, last(merged, "core", key)!) : undefined,
  );
}

function coreText(merged: MergedIni, key: string): string | undefined {
  const value = last(merged, "core", key);
  return value === undefined ? undefined : resolveValue(merged, value);
}

function normalizeText(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^[-•]\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" • ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceTags(merged: MergedIni): string[] {
  const result: string[] = [];
  for (const line of values(merged, "core", "tags")) {
    for (const tag of splitList(resolveValue(merged, line))) result.push(tag);
  }
  return [...new Set(result)];
}

function techLevel(merged: MergedIni): number | undefined {
  return coreNumber(merged, "techlevel") ?? parseNumber(merged.globals.get("techlevel"));
}

function tierFromTags(tags: string[]): string | undefined {
  for (const tag of tags) {
    if (/^TT/i.test(tag) || /^titan/i.test(tag)) return "titan";
    const match = /^T([1-4])/i.exec(tag);
    if (match) return `T${match[1]}`;
  }
  return undefined;
}

function classFromTags(tags: string[], isBuilding: boolean): string | undefined {
  if (isBuilding) return "building";
  const lower = tags.map((tag) => tag.toLowerCase());
  const matches = (pattern: RegExp): boolean => lower.some((tag) => pattern.test(tag));
  if (matches(/beast/) || lower.some((tag) => tag === "han")) return "beast";
  if (matches(/plant/)) return "plant";
  if (matches(/superinfantry/)) return "super-infantry";
  if (matches(/(^|t[1-4]|tt)infantry/)) return "infantry";
  if (matches(/superbot/)) return "super-bot";
  if (matches(/(^|t[1-4]|tt)bot/)) return "bot";
  if (matches(/supertank/)) return "super-tank";
  if (matches(/(^|t[1-4]|tt)tank/)) return "tank";
  if (matches(/superair/)) return "super-plane";
  if (matches(/(^|t[1-4]|tt)air|^air$|^heli$/)) return "plane";
  if (matches(/supership/)) return "super-ship";
  if (matches(/(^|t[1-4]|tt)ship|^nav$|^navt/)) return "ship";
  if (matches(/(^|t[1-4]|tt)space/)) return "space-ship";
  if (isBuilding) return "building";
  if (matches(/(^|t[1-4]|tt)supply|transportable|amphibian/)) return "tank";
  return undefined;
}

function movementFrom(merged: MergedIni, tags: string[], isBuilding: boolean): string | undefined {
  const raw = (last(merged, "movement", "movementtype") ?? "").trim().toUpperCase();
  if (raw === "LAND" || raw === "AIR" || raw === "WATER" || raw === "HOVER" || raw === "BUILDING") {
    return raw;
  }
  if (raw === "OVER_CLIFF" || raw === "OVER_CLIFF_WATER") return raw;
  if (isBuilding) return "BUILDING";
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => tag === "nav" || tag.includes("ship"))) return "WATER";
  if (lower.some((tag) => tag.includes("air"))) return "AIR";
  if (lower.some((tag) => tag.includes("hover") || tag.includes("amphibian"))) return "HOVER";
  return "LAND";
}

function canonicalTag(ctx: BuildContext, id: string): string | undefined {
  const alias = ctx.tagAliases?.get(id.toLowerCase());
  if (alias && ctx.tags.has(alias)) return alias;
  if (ctx.tags.has(id)) return id;
  const lower = id.toLowerCase();
  for (const tag of ctx.tags.values()) {
    if (tag.id.toLowerCase() === lower) return tag.id;
  }
  return undefined;
}

function buildCardTags(
  merged: MergedIni,
  isBuilding: boolean,
  existing: string[],
  ctx: BuildContext,
  defaultClass?: string,
): string[] {
  const tags = sourceTags(merged);
  const result = new Set(existing);
  const existingGroups = new Set(
    existing
      .map((id) => ctx.tags.get(id)?.group)
      .filter((group): group is string => Boolean(group)),
  );

  const addIfGroupFree = (id: string | undefined, group: string): void => {
    if (!id) return;
    if (existingGroups.has(group)) return;
    const canonical = canonicalTag(ctx, id);
    if (canonical) result.add(canonical);
  };

  const tier = tierFromTags(tags) ?? (techLevel(merged) ? `T${techLevel(merged)}` : "T1");
  addIfGroupFree(tier, "tier");

  const cls = classFromTags(tags, isBuilding) ?? defaultClass;
  addIfGroupFree(cls, "class");

  const movement = movementFrom(merged, tags, isBuilding);
  addIfGroupFree(movement, "movement");

  for (const tag of tags) {
    const canonical = canonicalTag(ctx, tag);
    if (canonical && ctx.tags.get(canonical)?.group === "mod") result.add(canonical);
  }

  if (coreNumber(merged, "nanorange") !== undefined) result.add("builder");
  if (isBuilding && [...merged.sections.keys()].some((name) => name.startsWith("canbuild"))) {
    result.add("factory");
  }
  if (globalNumber(merged, "shieldRadius") || globalNumber(merged, "lasdefradius"))
    result.add("shield");
  return [...result].filter(
    (id) => ctx.tags.get(id)?.group !== "weapon" && ctx.tags.get(id)?.group !== "sector",
  );
}

function weaponTags(
  merged: MergedIni,
  turret: Array<[string, string]>,
  projectile: Array<[string, string]>,
  range: number,
  ctx: BuildContext,
  unitTags: string[],
): string[] {
  const result = new Set<string>();
  const add = (id: string): void => {
    const canonical = canonicalTag(ctx, id);
    if (canonical && ctx.tags.get(canonical)?.group === "weapon") result.add(canonical);
  };

  const exactTrue = (key: string): boolean => {
    const value = (fieldValue(merged, "attack", turret, key, "attack") ?? "").trim().toLowerCase();
    return value === "true" || value === "1";
  };
  if (exactTrue("canattackflyingunits")) add("anti-air");
  if (exactTrue("canattackunderwaterunits")) add("anti-sub");

  const pTags = entryValues(projectile, "tags").flatMap((value) =>
    splitList(resolveValue(merged, value)),
  );
  const allProjectileTags = pTags.map((tag) => tag.toLowerCase());
  if (
    unitTags.some((tag) => /^(ORB|AORB)$/i.test(tag)) ||
    allProjectileTags.some((tag) => tag.includes("orb") || tag === "space") ||
    (fieldValue(merged, "attack", turret, "canonlyattackunitswithtags", "attack") ?? "")
      .toLowerCase()
      .includes("orb")
  ) {
    add("anti-orbital");
  }
  if (
    allProjectileTags.some((tag) => tag.includes("laser")) ||
    entryLast(projectile, "beamimage")
  ) {
    add("laser");
  }
  if (
    allProjectileTags.some(
      (tag) => /^ro\d/.test(tag) || tag.includes("rocket") || tag.includes("missile"),
    )
  ) {
    add("rocket");
  }
  if (allProjectileTags.some((tag) => tag.includes("plasma"))) add("plasma");
  if (allProjectileTags.some((tag) => tag.includes("blaster"))) add("blaster");

  const areaRadius = numberValue(merged, "projectile", projectile, "arearadius");
  if (areaRadius !== undefined && areaRadius > 0) add("splash");

  const stun = entryValues(projectile, "mutator2_addresourcesareahit")
    .concat(entryValues(projectile, "mutator2_addresourcesdirecthit"))
    .concat(entryValues(projectile, "mutatorx_addresourcesareahit"))
    .some((value) => /stun\s*=/i.test(value));
  if (stun) add("stun");

  if (range >= 350) add("long");
  else if (range > 0 && range <= 80) add("close");

  return [...result];
}

function parseStun(entries: Array<[string, string]>): number | undefined {
  let max: number | undefined;
  for (const [key, value] of entries) {
    if (!key.startsWith("mutator")) continue;
    const match = /stun\s*=\s*([0-9.]+)/i.exec(value);
    if (!match) continue;
    const duration = Number(match[1]);
    if (Number.isFinite(duration) && (max === undefined || duration > max)) max = duration;
  }
  return max;
}

function weaponName(tags: string[], index: number): Text {
  if (tags.includes("rocket")) return { ru: "Ракеты", en: "Missiles" };
  if (tags.includes("laser")) return { ru: "Лазер", en: "Laser" };
  if (tags.includes("plasma")) return { ru: "Плазма", en: "Plasma" };
  if (tags.includes("blaster")) return { ru: "Бластер", en: "Blaster" };
  if (tags.includes("splash")) return { ru: "Артиллерия", en: "Artillery" };
  if (tags.includes("anti-air")) return { ru: "ПВО", en: "AA" };
  return { ru: `Орудие ${index}`, en: `Weapon ${index}` };
}

function extractWeapons(
  merged: MergedIni,
  range: number,
  ctx: BuildContext,
  unitTags: string[],
): WeaponData[] {
  const turretNames = [...merged.sections.keys()].filter((name) => /^turret[_-]/.test(name));
  const attackDelay = parseTicks(last(merged, "attack", "shootdelay"));
  const groups = new Map<string, { weapon: WeaponData; count: number }>();

  for (const turretName of turretNames) {
    if (
      /^(turret_stun|turret_md|turret_md2|turret_td|turret_td2|turret_tmd|turret_antisilo|turret_antisilogi|turret_sva|turret_ice|turret_nu|turret_land)/i.test(
        turretName,
      )
    ) {
      continue;
    }
    const turret = expandEntries(merged, turretName, "turret");
    if (
      boolValue(merged, turretName, turret, "canshoot", "core") === false &&
      !entryLast(turret, "canshoot")
    ) {
      // По умолчанию canShoot: true, но явный false отсекаем ниже.
    }
    if ((entryLast(turret, "canshoot") ?? "").toLowerCase() === "false") continue;
    if ((entryLast(turret, "ismainnanoturret") ?? "").toLowerCase() === "true") continue;

    const projectileRef =
      entryLast(turret, "projectile") ??
      (getSection(merged, `projectile_${turretName.replace(/^turret[_-]/, "")}`)
        ? turretName.replace(/^turret[_-]/, "")
        : undefined);
    if (!projectileRef || projectileRef.includes("${")) continue;
    const projectileName = `projectile_${projectileRef}`;
    const projectile = expandEntries(merged, projectileName, "projectile");
    if (projectile.length === 0) continue;

    const direct = numberValue(merged, "projectile", projectile, "directdamage") ?? 0;
    const area = numberValue(merged, "projectile", projectile, "areadamage") ?? 0;
    const damage = direct > 0 ? direct : area;
    if (!(damage > 0)) continue;

    const shootDelay = parseTicks(
      entryLast(turret, "shootdelay") ??
        entryLast(turret, "delay") ??
        last(merged, "attack", "shootdelay"),
    );
    const fireDelay = Math.max(shootDelay ?? attackDelay ?? 1, 1 / 60);
    const armourIgnoreAmount = numberValue(merged, "projectile", projectile, "armourignoreamount");
    const splashRadius = numberValue(merged, "projectile", projectile, "arearadius");
    const spread =
      numberValue(merged, "projectile", projectile, "targetgroundspread") ??
      numberValue(merged, "projectile", projectile, "spread");
    const stunDuration = parseStun(projectile);
    const tags = weaponTags(merged, turret, projectile, range, ctx, unitTags);
    const signature = JSON.stringify({
      projectileRef,
      damage,
      fireDelay: Number(fireDelay.toFixed(4)),
      armourIgnoreAmount,
      splashRadius,
      spread,
      stunDuration,
      tags: [...tags].sort(),
    });

    const existing = groups.get(signature);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const name = weaponName(tags, groups.size + 1);
    groups.set(signature, {
      count: 1,
      weapon: {
        name,
        count: 1,
        projectileCount: 1,
        projectileDelay: 0,
        damage,
        fireDelay: Number(fireDelay.toFixed(4)),
        mainDps: false,
        ...(armourIgnoreAmount !== undefined ? { armourIgnoreAmount } : {}),
        tags,
        ...(spread !== undefined ? { spread } : {}),
        ...(splashRadius !== undefined ? { splashRadius } : {}),
        ...(stunDuration !== undefined ? { stunDuration } : {}),
      },
    });
  }

  const weapons = [...groups.values()].map(({ weapon, count }) => ({ ...weapon, count }));
  if (weapons.length === 0) return [];
  let best = 0;
  let bestScore = -1;
  for (const [index, weapon] of weapons.entries()) {
    const score = weapon.damage * weapon.count;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  weapons[best]!.mainDps = true;
  return weapons;
}

function extractAbilities(
  merged: MergedIni,
  ctx: BuildContext,
  cardName: Text,
  isBuilding: boolean,
): Pick<
  CardPatch,
  | "missileDefense"
  | "torpedoDefense"
  | "laserDefense"
  | "domeShield"
  | "atmosphere"
  | "ftlJump"
  | "builder"
  | "factories"
  | "transports"
> {
  const result: ReturnType<typeof extractAbilities> = {};
  const templates = merged.templates.map((file) => file.toLowerCase());
  const hasTemplate = (needle: string): boolean => templates.some((file) => file.includes(needle));

  if (hasTemplate("antitact") || merged.sections.has("action_buildtmd")) {
    result.missileDefense = { max: 1, recharge: 16 };
  } else if (hasTemplate("antinu") || merged.sections.has("action_buildantinuke")) {
    result.missileDefense = { max: 1, recharge: 80 };
  } else if (hasTemplate("antigi") || merged.sections.has("action_buildantigi")) {
    result.missileDefense = { max: 1, recharge: 200 };
  }

  if (
    hasTemplate("depthcharges") ||
    merged.sections.has("turret_td") ||
    merged.sections.has("projectile_torpedo")
  ) {
    result.torpedoDefense = { max: 1, recharge: 10 };
  }

  const laserRadius = globalNumber(merged, "lasdefradius") ?? coreNumber(merged, "lasdefradius");
  const laserPoints = globalNumber(merged, "energymax") ?? coreNumber(merged, "energymax");
  if (
    laserRadius !== undefined &&
    laserRadius > 0 &&
    laserPoints !== undefined &&
    laserPoints > 0
  ) {
    result.laserDefense = {
      radius: laserRadius,
      points: laserPoints,
      regen: coreNumber(merged, "energyregen") ?? 0.1,
    };
  }

  const shieldRadius = globalNumber(merged, "shieldradius") ?? coreNumber(merged, "shieldradius");
  const shieldPoints = globalNumber(merged, "maxshield") ?? coreNumber(merged, "maxshield");
  if (
    shieldRadius !== undefined &&
    shieldRadius > 0 &&
    shieldPoints !== undefined &&
    shieldPoints > 0
  ) {
    result.domeShield = {
      radius: shieldRadius,
      points: shieldPoints,
      regen: coreNumber(merged, "shieldregen") ?? 0,
    };
  }

  const atmo = globalNumber(merged, "atmo") ?? coreNumber(merged, "atmo");
  if (atmo !== undefined && atmo > 0) result.atmosphere = { time: atmo };

  const jumpCharge = globalNumber(merged, "jumpwu") ?? coreNumber(merged, "jumpwu");
  const jumpCooldown = globalNumber(merged, "jumpcd") ?? coreNumber(merged, "jumpcd");
  if (jumpCharge !== undefined && jumpCharge > 0 && jumpCooldown !== undefined) {
    let type: "siv" | "plasma" | "tele" = "siv";
    let minDistance = 2000;
    if (hasTemplate("pejump")) {
      type = "plasma";
      minDistance = 1000;
    } else if (hasTemplate("telejump")) {
      type = "tele";
      minDistance = 2500;
    }
    const energyCost = globalNumber(merged, "jumpprice") ?? coreNumber(merged, "jumpprice");
    result.ftlJump = {
      type,
      chargeTime: jumpCharge,
      cooldown: jumpCooldown,
      minDistance,
      ...(energyCost !== undefined && energyCost > 0 ? { energyCost } : {}),
    };
  }

  const nanoRange = coreNumber(merged, "nanorange");
  if (nanoRange !== undefined && nanoRange > 0) {
    const healTags: string[] = [];
    for (const value of values(merged, "core", "canrepairunitsonlywithtags")) {
      for (const tag of splitList(resolveValue(merged, value))) {
        const lower = tag.toLowerCase();
        if (lower.includes("infantry")) healTags.push("infantry");
        else if (lower.includes("bot")) healTags.push("bot");
        else if (lower.includes("tank")) healTags.push("tank");
        else if (lower.includes("aircraft")) healTags.push("plane");
        else if (lower.includes("ship") || lower.includes("sub")) healTags.push("ship");
        else if (lower.includes("spacecraft") || lower.includes("capital"))
          healTags.push("space-ship");
        else if (lower.includes("building")) healTags.push("building");
      }
    }
    result.builder = {
      buildRange: nanoRange,
      repairSpeed: coreNumber(merged, "nanorepairspeed") ?? 0,
      buildSpeed: 1,
      healTags: [...new Set(healTags)],
    };
  }

  if (isBuilding) {
    const produced: string[] = [];
    for (const name of merged.sections.keys()) {
      if (!name.startsWith("canbuild")) continue;
      for (const value of values(merged, name, "name")) {
        for (const token of splitList(resolveValue(merged, value))) {
          if (token.includes("${") || token.includes("(") || token.includes("*")) continue;
          const id = ctx.sourceToId.get(normalizedSourceName(token));
          if (id && ctx.unitIds.has(id)) produced.push(id);
        }
      }
    }
    if (produced.length > 0) {
      result.factories = [
        {
          name: cardName,
          buildSpeed: coreNumber(merged, "nanofactoryspeed") ?? 1,
          producedUnits: [...new Set(produced)],
        },
      ];
    }
  }

  const seats = coreNumber(merged, "maxtransportingunits");
  if (seats !== undefined && seats > 0) {
    const cargoTags: string[] = [];
    for (const value of values(merged, "core", "transportunitsrequiretag")) {
      for (const tag of splitList(resolveValue(merged, value))) {
        const lower = tag.toLowerCase();
        if (lower.includes("sol") || lower.includes("infantry")) cargoTags.push("infantry");
        if (lower.includes("tank")) cargoTags.push("tank");
        if (lower.includes("bot")) cargoTags.push("bot");
        if (lower.includes("air") || lower.includes("ring")) cargoTags.push("plane");
        if (lower.includes("ship") && !lower.includes("space")) cargoTags.push("ship");
        if (lower.includes("space") || lower.includes("orb")) cargoTags.push("space-ship");
        if (lower.includes("building")) cargoTags.push("building");
        if (lower === "transportable") {
          cargoTags.push("infantry", "tank", "bot");
        }
      }
    }
    const unload: string[] = [];
    const has = (needle: string): boolean => hasTemplate(needle);
    if (has("transporterall")) unload.push("shore", "water", "air", "underwater", "space");
    else {
      if (has("goinorb")) unload.push("space");
      if (has("goinsub")) unload.push("underwater");
      if (has("goinship")) unload.push("water");
      if (has("goina") || has("goinhelic")) unload.push("air");
      if (has("goinsol") || has("gointransport") || has("goinring")) unload.push("shore");
    }
    result.transports = [
      {
        name: cardName,
        seats,
        cargoTags: [...new Set(cargoTags)],
        unload: [...new Set(unload)],
      },
    ];
  }

  return result;
}

export function buildCard(
  card: SourceCard,
  ctx: BuildContext,
  existing?: { id: string; tags?: string[] },
  defaultClass?: string,
): CardBuildResult {
  const merged = card.merged;
  const name = displayName(merged) ?? { ru: card.sourceName, en: card.sourceName };
  const rawDesc = displayDescription(merged);
  const desc = rawDesc
    ? { ru: normalizeText(rawDesc.ru) || name.ru, en: normalizeText(rawDesc.en) || name.en }
    : { ru: name.ru, en: name.en };

  const priceRaw = coreText(merged, "price") ?? merged.globals.get("price");
  const priceResolved = priceRaw ? resolveValue(merged, priceRaw) : undefined;
  let cost = parseNumber(priceResolved?.split(",")[0]);
  if (cost === undefined) cost = globalNumber(merged, "price");
  const energyFromPrice = priceResolved
    ? /power\s*=\s*([0-9.]+)/i.exec(priceResolved)?.[1]
    : undefined;
  const energy =
    globalNumber(merged, "energy") ??
    parseNumber(energyFromPrice) ??
    coreNumber(merged, "power") ??
    0;

  const hp = globalNumber(merged, "maxhp") ?? coreNumber(merged, "maxhp") ?? 0;
  const buildTime = parseSeconds(coreText(merged, "buildspeed")) ?? 0;

  const armor = coreNumber(merged, "armour") ?? globalNumber(merged, "armour");
  const shield = globalNumber(merged, "maxshield") ?? coreNumber(merged, "maxshield");
  const shieldRegen = coreNumber(merged, "shieldregen");
  const selfRegen = coreNumber(merged, "selfregenrate");
  const speed =
    coreNumber(merged, "movespeed") ?? parseNumber(last(merged, "movement", "movespeed"));
  const turnSpeed =
    coreNumber(merged, "maxturnspeed") ?? parseNumber(last(merged, "movement", "maxturnspeed"));
  const range = parseNumber(
    coreText(merged, "maxattackrange") ?? last(merged, "attack", "maxattackrange"),
  );
  const unitTags = sourceTags(merged);
  const tags = buildCardTags(merged, card.isBuilding, existing?.tags ?? [], ctx, defaultClass);
  const weapons = extractWeapons(merged, range ?? 0, ctx, unitTags);
  const abilities = extractAbilities(merged, ctx, name, card.isBuilding);

  const id = existing?.id ?? siteIdForSourceName(card.sourceName);
  const patch: CardPatch = {
    name,
    desc,
    faction: card.faction,
    tags,
    ...(cost !== undefined ? { cost } : {}),
    energy,
    hp,
    ...(armor !== undefined && armor > 0 ? { armor } : {}),
    ...(shield !== undefined && shield > 0 ? { shield } : {}),
    ...(shieldRegen !== undefined && shieldRegen > 0 ? { shieldRegen } : {}),
    ...(selfRegen !== undefined && selfRegen > 0 ? { selfRegen } : {}),
    ...(speed !== undefined && speed > 0 ? { speed } : {}),
    ...(turnSpeed !== undefined && turnSpeed > 0 ? { turnSpeed } : {}),
    ...(range !== undefined && range > 0 && weapons.length > 0 ? { range } : {}),
    buildTime,
    ...(weapons.length > 0 ? { weapons } : {}),
    ...abilities,
  };

  return {
    card: patch,
    sourceName: card.sourceName,
    isBuilding: card.isBuilding,
    id,
    variant: card.variant,
    unresolved: merged.unresolved,
  };
}

export { detectBuilding };
