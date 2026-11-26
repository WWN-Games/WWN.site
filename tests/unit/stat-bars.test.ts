import { describe, expect, it } from "vitest";

import { barPercent, computeStatScale, type StatValueSource } from "../../src/lib/card-stats";

function source(overrides: Partial<StatValueSource> = {}): StatValueSource {
  return {
    hp: 100,
    shield: 0,
    armor: 0,
    selfRegen: 0,
    shieldRegen: 0,
    mainDps: 0,
    speed: 0,
    range: 0,
    ...overrides,
  };
}

describe("stat bars", () => {
  it("строит линейную шкалу по максимуму выборки", () => {
    const scale = computeStatScale([
      source({ hp: 100, shield: 20, speed: 1 }),
      source({ hp: 300, shield: 40, speed: 3 }),
    ]);

    expect(scale.hp).toEqual({ max: 300, median: 200 });
    expect(scale.shield).toEqual({ max: 300, median: 30 });
    expect(scale.speed).toEqual({ max: 3, median: 2 });
    expect(scale.range).toBeNull();
  });

  it("делит максимум HP и щита по большему значению", () => {
    const hpBigger = computeStatScale([
      source({ hp: 1000, shield: 100 }),
      source({ hp: 800, shield: 400 }),
    ]);
    expect(hpBigger.hp?.max).toBe(1000);
    expect(hpBigger.shield?.max).toBe(1000);

    const shieldBigger = computeStatScale([
      source({ hp: 200, shield: 1200 }),
      source({ hp: 1000, shield: 900 }),
    ]);
    expect(shieldBigger.hp?.max).toBe(1200);
    expect(shieldBigger.shield?.max).toBe(1200);
  });

  it("оставляет DPS и броню видимыми даже при нулях", () => {
    const scale = computeStatScale([source()]);
    expect(scale.armor).toEqual({ max: 0, median: 0 });
    expect(scale.dps).toEqual({ max: 0, median: 0 });
    expect(scale.hp).toEqual({ max: 100, median: 100 });
  });

  it("считает процент линейно и обрезает выше максимума", () => {
    expect(barPercent(100, 100)).toBe(100);
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(25, 100)).toBe(25);
    expect(barPercent(150, 100)).toBe(100);
    expect(barPercent(1, 3)).toBe(33.33);
    expect(barPercent(0, 100)).toBe(0);
    expect(barPercent(50, 0)).toBe(0);
  });
});
