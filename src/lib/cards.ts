/* ============================================================================
   WWN — чистые правила карточек, общие для сайта, API и админки.
   ============================================================================ */

import { fullCost, totalWeaponDps, type WeaponLike } from "./card-stats.ts";

type CardLike = {
  id?: string | undefined;
  cost?: number | undefined;
  energy?: number | undefined;
  weapons?: readonly WeaponLike[] | undefined;
};

/** DPS карточки считается по оружию; без оружия — 0. */
export function withDerivedDps<T extends CardLike>(item: T): T & { dps: number } {
  return {
    ...item,
    dps: totalWeaponDps(item.weapons),
  };
}

/** DPS и полная стоимость — для карточек базы и публичного API. */
export function withDerivedCard<T extends CardLike>(
  item: T,
): T & { dps: number; fullCost: number } {
  return {
    ...item,
    dps: totalWeaponDps(item.weapons),
    fullCost: fullCost(item.cost ?? 0, item.energy ?? 0),
  };
}

/** Плашка «Новинка!»: флаг и необязательная дата окончания показа. */
export function isBadgeNew(
  flag: boolean | undefined,
  until: string | undefined,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!flag) return false;
  return !until || until >= today;
}
