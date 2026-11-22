/* ============================================================================
   WWN — производные метрики подвигов.
   Чистые функции без Astro и DOM: используются страницей и unit-тестами.
   ============================================================================ */

import type { FeatItem } from "./schemas";

/** Цена подвига: ручное значение или сумма полной стоимости связанных юнитов. */
export function featPrice(feat: FeatItem, unitCosts: ReadonlyMap<string, number>): number {
  if (feat.cost !== undefined) return Math.max(0, feat.cost);
  return feat.unitIds.reduce((sum, id) => sum + (unitCosts.get(id) ?? 0), 0);
}

/** Цена уничтоженных: для битвы — потери противников. */
export function featDestroyedCost(feat: FeatItem): number {
  return feat.type === "battle"
    ? Math.max(0, feat.enemyLossCost ?? 0)
    : Math.max(0, feat.destroyedCost ?? 0);
}

/** Количество убитых: для битвы — потери противников. */
export function featKilledCount(feat: FeatItem): number {
  return feat.type === "battle"
    ? Math.max(0, feat.enemyLossCount ?? 0)
    : Math.max(0, feat.destroyedCount ?? 0);
}

/** Окупаемость: для битвы — обмен стоимостью потерь. */
export function featPayoff(feat: FeatItem, price: number): number | null {
  const destroyed = featDestroyedCost(feat);
  if (feat.type === "battle") {
    const hero = Math.max(0, feat.heroLossCost ?? 0);
    return hero > 0 ? destroyed / hero : null;
  }
  return price > 0 ? destroyed / price : null;
}

/** Соотношение потерь юнитов (только битвы): противники / герои. */
export function featLossRatio(feat: FeatItem): number | null {
  if (feat.type !== "battle") return null;
  const hero = Math.max(0, feat.heroLossCount ?? 0);
  return hero > 0 ? Math.max(0, feat.enemyLossCount ?? 0) / hero : null;
}
