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
}

export interface StatScaleEntryLike {
  lo: number;
  hi: number;
  median: number;
}

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

/** Подходит ли оружие под выбранные теги с учётом режима И / ИЛИ. */
export function weaponMatchesTags(
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

const MIN_BAR = 10;

export function barPercent(value: number, entry: StatScaleEntryLike | null): number {
  if (!(value > 0) || !entry) return 0;
  const lo = Math.max(entry.lo, 0.01);
  const hi = Math.max(entry.hi, lo * 1.01);
  const span = Math.log(hi / lo);
  if (!(span > 0)) return 100;
  const position = Math.log(Math.max(value, lo) / lo) / span;
  return Math.max(MIN_BAR, Math.min(100, Math.round(MIN_BAR + (100 - MIN_BAR) * position)));
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
