import { describe, expect, it } from "vitest";

import {
  bestIndexes,
  MAX_COMPARE,
  metricValue,
  parseCompareParam,
  serializeCompareParam,
} from "../../src/lib/compare";
import type { ExplorerItem } from "../../src/lib/database";
import { filterItems, searchTokens, sortItems } from "../../src/lib/database-view";

function item(overrides: Partial<ExplorerItem> = {}): ExplorerItem {
  return {
    id: "unit-a",
    tab: "units",
    faction: "fenearth",
    type: "ground",
    tags: ["T1", "tank"],
    cost: 100,
    hp: 500,
    shield: 0,
    dps: 50,
    speed: 1,
    range: 200,
    buildTime: 10,
    searchText: "тестовый танк наземная",
    name: "Тестовый танк",
    factionName: "Фенземская Республика",
    factionColor: "#3b9bff",
    typeLabel: "Наземные",
    image: null,
    initials: "ТТ",
    ...overrides,
  };
}

describe("database view", () => {
  it("ищет по токенам в любом порядке", () => {
    expect(searchTokens("  ТАНК   тестовый ")).toEqual(["танк", "тестовый"]);
    const items = [item(), item({ id: "b", searchText: "истребитель воздуха" })];
    expect(
      filterItems(items, {
        query: "тестовый танк",
        faction: "all",
        type: "all",
        tags: [],
        tagMode: "all",
      }),
    ).toHaveLength(1);
  });

  it("фильтрует по фракции и типу, а теги — по режиму И/ИЛИ", () => {
    const items = [
      item(),
      item({ id: "b", faction: "proton", tags: ["T2"] }),
      item({ id: "c", tags: ["T2", "ship"] }),
    ];
    expect(
      filterItems(items, {
        query: "",
        faction: "proton",
        type: "all",
        tags: ["T2"],
        tagMode: "all",
      }).map((entry) => entry.id),
    ).toEqual(["b"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        type: "all",
        tags: ["T1", "T2"],
        tagMode: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        type: "all",
        tags: ["T1", "T2"],
        tagMode: "any",
      }).map((entry) => entry.id),
    ).toEqual(["unit-a", "b", "c"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        type: "all",
        tags: ["T1", "T2"],
        tagMode: "any",
      }),
    ).toHaveLength(3);
  });

  it("сортирует числом и направлением, имя — tie-breaker", () => {
    const items = [
      item({ id: "a", name: "Альфа", cost: 100 }),
      item({ id: "b", name: "Бета", cost: 300 }),
      item({ id: "c", name: "Гамма", cost: 100 }),
    ];
    expect(sortItems(items, "cost", "desc", "ru").map((entry) => entry.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortItems(items, "cost", "asc", "ru").map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });
});

describe("compare", () => {
  it("считает производные метрики и лучшие значения", () => {
    const a = item({ id: "a", cost: 100, hp: 1000, dps: 100 });
    const b = item({ id: "b", cost: 200, hp: 1000, dps: 50 });
    expect(metricValue(a, "totalHp")).toBe(a.hp + a.shield);
    expect(metricValue(a, "dpsPerCost")).toBe(100);
    expect(metricValue(b, "hpPerCost")).toBe(500);
    expect(bestIndexes([100, 200, null], "lower")).toEqual([0]);
    expect(bestIndexes([100, 200, 100], "higher")).toEqual([1]);
    expect(bestIndexes([100, 100], "higher")).toEqual([]);
  });

  it("кодирует и разбирает URL, соблюдая лимит и вкладку", () => {
    const items = new Map<string, ExplorerItem>([
      ["a", item({ id: "a" })],
      ["b", item({ id: "b" })],
      ["c", item({ id: "c" })],
      ["d", item({ id: "d" })],
      ["e", item({ id: "e" })],
      ["building", item({ id: "building", tab: "buildings" })],
    ]);
    const encoded = serializeCompareParam("units", ["a", "b", "a", "c", "d", "e"]);
    expect(encoded).toBe(`units:a,b,c,d`);
    expect(parseCompareParam(encoded, items)).toEqual({ tab: "units", ids: ["a", "b", "c", "d"] });
    expect(parseCompareParam("units:a,building", items)).toEqual({ tab: "units", ids: ["a"] });
    expect(parseCompareParam("bad:a", items)).toBeNull();
    expect(MAX_COMPARE).toBe(4);
  });
});
