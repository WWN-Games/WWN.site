import { describe, expect, it } from "vitest";

import {
  featDestroyedCost,
  featKilledCount,
  featLossRatio,
  featPayoff,
  featPrice,
} from "../../src/lib/feats";
import { featSchema } from "../../src/lib/schemas";

const unitFeat = featSchema.parse({
  id: "unit-feat",
  name: { ru: "Подвиг" },
  desc: { ru: "Описание" },
  type: "unit",
  unitIds: ["a"],
  destroyedCost: 300,
  destroyedCount: 4,
});

const battleFeat = featSchema.parse({
  id: "battle-feat",
  name: { ru: "Битва" },
  desc: { ru: "Описание" },
  type: "battle",
  heroLossCost: 100,
  enemyLossCost: 250,
  heroLossCount: 2,
  enemyLossCount: 5,
});

describe("feats", () => {
  it("считает цену, уничтоженное и окупаемость юнита", () => {
    const costs = new Map([["a", 150]]);
    const price = featPrice(unitFeat, costs);
    expect(price).toBe(150);
    expect(featPrice(unitFeat, new Map())).toBe(0);
    expect(featPrice({ ...unitFeat, cost: 90 }, costs)).toBe(90);
    expect(featDestroyedCost(unitFeat)).toBe(300);
    expect(featKilledCount(unitFeat)).toBe(4);
    expect(featPayoff(unitFeat, price)).toBe(2);
  });

  it("считает потери и соотношение для битвы", () => {
    expect(featDestroyedCost(battleFeat)).toBe(250);
    expect(featKilledCount(battleFeat)).toBe(5);
    expect(featPayoff(battleFeat, 0)).toBe(2.5);
    expect(featLossRatio(battleFeat)).toBe(2.5);
    expect(featLossRatio(unitFeat)).toBeNull();
    expect(featPayoff(unitFeat, 0)).toBeNull();
  });
});
