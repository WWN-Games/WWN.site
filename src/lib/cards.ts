/* ============================================================================
   WWN — чистые правила карточек, общие для сайта, API и админки.
   ============================================================================ */

/** DPS карточки считается по сумме урона всех орудий, если они заданы. */
export function withDerivedDps<
  T extends { id?: string; dps?: number | undefined; weapons?: { damage: number }[] | undefined },
>(item: T): T {
  const weapons = item.weapons;
  if (!weapons?.length) return item;
  return {
    ...item,
    dps: weapons.reduce((sum, weapon) => sum + weapon.damage, 0),
  };
}
