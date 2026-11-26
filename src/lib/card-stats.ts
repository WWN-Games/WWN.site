/* ============================================================================
   WWN — чистые расчёты карточек: полная стоимость, DPS оружия, фильтрация
   оружия по тегам и проценты полос. Модуль не зависит от Astro и DOM,
   поэтому его используют и сборка, и Svelte-острова, и тесты.
   ============================================================================ */

import type { TagMatchMode } from "./database-constants";

export interface WeaponLike {
  count?: number | undefined;
  projectileCount?: number | undefined;
  damage: number;
  fireDelay: number;
  tags?: readonly string[] | undefined;
  mainDps?: boolean | undefined;
}

export const STAT_KEYS = [
  "hp",
  "shield",
  "armor",
  "selfRegen",
  "shieldRegen",
  "dps",
  "speed",
  "range",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Минимум полей карточки, нужный для расчёта полос. */
export interface StatValueSource {
  hp: number;
  shield: number;
  armor: number;
  selfRegen: number;
  shieldRegen: number;
  mainDps: number;
  speed: number;
  range: number;
}

export interface StatScaleEntry {
  max: number;
  median: number;
}

export type StatScale = Record<StatKey, StatScaleEntry | null>;

/** Эти полосы показываются даже при нулевых значениях у всей выборки. */
const ALWAYS_VISIBLE_STATS = new Set<StatKey>(["dps", "armor"]);

/** Полная стоимость = цена + энергия / 4. */
export function fullCost(cost: number, energy: number): number {
  return cost + Math.max(0, energy) / 4;
}

/** DPS одного орудия: пушки × снаряды за выстрел × урон снаряда / задержка. */
export function weaponDps(weapon: WeaponLike): number {
  const count = Number.isFinite(weapon.count) ? Math.max(1, weapon.count ?? 1) : 1;
  const projectiles = Number.isFinite(weapon.projectileCount)
    ? Math.max(1, weapon.projectileCount ?? 1)
    : 1;
  if (!(weapon.damage > 0) || !(weapon.fireDelay > 0)) return 0;
  return (count * projectiles * weapon.damage) / weapon.fireDelay;
}

/** Суммарный DPS всех орудий. */
export function totalWeaponDps(weapons: readonly WeaponLike[] | undefined): number {
  if (!weapons?.length) return 0;
  let sum = 0;
  for (const weapon of weapons) sum += weaponDps(weapon);
  return sum;
}

/**
 * Основной ДПС: сумма только отмеченных орудий.
 * Если ни одно орудие не отмечено, основной ДПС равен полному.
 */
export function mainWeaponDps(weapons: readonly WeaponLike[] | undefined): number {
  if (!weapons?.length) return 0;
  const primary = weapons.filter((weapon) => weapon.mainDps);
  return totalWeaponDps(primary.length > 0 ? primary : weapons);
}

/** Подходит ли оружие под выбранные теги с учётом режима И / ИЛИ. */
function weaponMatchesTags(
  weapon: WeaponLike,
  tags: readonly string[],
  mode: TagMatchMode,
): boolean {
  if (tags.length === 0) return true;
  const weaponTags = weapon.tags ?? [];
  return mode === "any"
    ? tags.some((id) => weaponTags.includes(id))
    : tags.every((id) => weaponTags.includes(id));
}

/** Оставляет только оружие, подходящее под выбранные теги. */
export function filterWeapons<T extends WeaponLike>(
  weapons: readonly T[],
  tags: readonly string[],
  mode: TagMatchMode,
): T[] {
  if (tags.length === 0) return [...weapons];
  return weapons.filter((weapon) => weaponMatchesTags(weapon, tags, mode));
}

/** DPS только тех оружий, которые подходят под выбранные теги. */
export function filteredWeaponDps(
  weapons: readonly WeaponLike[] | undefined,
  tags: readonly string[],
  mode: TagMatchMode,
): number {
  if (!weapons?.length) return 0;
  if (tags.length === 0) return totalWeaponDps(weapons);
  return totalWeaponDps(filterWeapons(weapons, tags, mode));
}

/** Основной ДПС только по оружию, подходящему под выбранные теги. */
export function filteredMainWeaponDps(
  weapons: readonly WeaponLike[] | undefined,
  tags: readonly string[],
  mode: TagMatchMode,
): number {
  if (!weapons?.length) return 0;
  return mainWeaponDps(filterWeapons(weapons, tags, mode));
}

/** Есть ли у карточки хотя бы одно оружие под выбранные теги. */
export function hasMatchingWeapon(
  weapons: readonly WeaponLike[] | undefined,
  tags: readonly string[],
  mode: TagMatchMode,
): boolean {
  if (tags.length === 0) return true;
  if (!weapons?.length) return false;
  return weapons.some((weapon) => weaponMatchesTags(weapon, tags, mode));
}

function medianOf(values: readonly number[]): number {
  const mid = Math.floor(values.length / 2);
  if (values.length % 2) return values[mid] ?? 0;
  return ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
}

/**
 * Линейная шкала по текущей выборке: максимум каждого стата становится 100%.
 * HP и щит делят один максимум — больший из двух, чтобы полосы были сравнимы.
 * Нулевые значения не участвуют в расчёте шкалы и медианы.
 */
export function computeStatScale(items: readonly StatValueSource[]): StatScale {
  const scale = {} as StatScale;
  for (const key of STAT_KEYS) {
    const values = items
      .map((item) => (key === "dps" ? item.mainDps : item[key]))
      .filter((value) => value > 0)
      .toSorted((a, b) => a - b);
    if (!values.length) {
      scale[key] = ALWAYS_VISIBLE_STATS.has(key) ? { max: 0, median: 0 } : null;
      continue;
    }
    scale[key] = {
      max: values[values.length - 1] ?? 0,
      median: medianOf(values),
    };
  }

  const hpShieldMax = Math.max(scale.hp?.max ?? 0, scale.shield?.max ?? 0);
  if (scale.hp) scale.hp.max = hpShieldMax;
  if (scale.shield) scale.shield.max = hpShieldMax;

  return scale;
}

/** Линейный процент: 0 — пусто, max — 100%, значения выше max обрезаются. */
export function barPercent(value: number, max: number | null | undefined): number {
  if (!(value > 0) || !(max && max > 0)) return 0;
  const percent = (value / max) * 100;
  return Math.min(100, Math.round(percent * 100) / 100);
}

/** Компактный формат значения полосы: 2 знака < 10, 1 знак < 1000, дальше целое. */
export function formatStat(value: number): string {
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
