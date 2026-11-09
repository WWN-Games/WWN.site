import { describe, expect, it } from "vitest";

import { filteredWeaponDps, fullCost, weaponDps } from "../../src/lib/card-stats";
import {
  bestIndexes,
  MAX_COMPARE,
  metricValue,
  parseCardParam,
  parseCompareParam,
  serializeCardParam,
  serializeCompareParam,
} from "../../src/lib/compare";
import type { ExplorerItem } from "../../src/lib/database";
import {
  filterItems,
  type SearchableExplorerItem,
  searchTokens,
  sortItems,
} from "../../src/lib/database-view";
import { withDerivedDps } from "../../src/pages/api/v1/_shared";

function item(overrides: Partial<SearchableExplorerItem> = {}): SearchableExplorerItem {
  return {
    id: "unit-a",
    tab: "units",
    faction: "fenearth",
    tags: ["T1", "tank"],
    cost: 100,
    energy: 40,
    fullCost: 110,
    hp: 500,
    shield: 0,
    armor: 0,
    selfRegen: 0,
    shieldRegen: 0,
    dps: 50,
    weapons: [],
    builder: undefined,
    factories: [],
    transports: [],
    speed: 1,
    turnSpeed: 0,
    range: 200,
    buildTime: 10,
    searchText: "тестовый танк наземная",
    name: "Тестовый танк",
    desc: "Описание",
    role: "",
    strongVs: [],
    weakVs: [],
    factionName: "Фенземская Республика",
    factionColor: "#3b9bff",
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
        tags: [],
        tagMode: "all",
        weaponTags: [],
        weaponTagMode: "all",
      }),
    ).toHaveLength(1);
  });

  it("фильтрует по фракции, тегам и тегам оружия", () => {
    const items = [
      item(),
      item({ id: "b", faction: "proton", tags: ["T2"] }),
      item({ id: "c", tags: ["T2", "ship"] }),
      item({
        id: "d",
        weapons: [
          {
            name: "Ракета",
            count: 1,
            damage: 10,
            fireDelay: 1,
            dps: 10,
            tags: ["rocket", "anti-air"],
          },
        ],
      }),
    ];
    expect(
      filterItems(items, {
        query: "",
        faction: "proton",
        tags: ["T2"],
        tagMode: "all",
        weaponTags: [],
        weaponTagMode: "all",
      }).map((entry) => entry.id),
    ).toEqual(["b"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        tags: ["T1", "T2"],
        tagMode: "all",
        weaponTags: [],
        weaponTagMode: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        tags: ["T1", "T2"],
        tagMode: "any",
        weaponTags: [],
        weaponTagMode: "all",
      }).map((entry) => entry.id),
    ).toEqual(["unit-a", "b", "c", "d"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        tags: [],
        tagMode: "all",
        weaponTags: ["rocket"],
        weaponTagMode: "all",
      }).map((entry) => entry.id),
    ).toEqual(["d"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        tags: [],
        tagMode: "all",
        weaponTags: ["rocket", "anti-air"],
        weaponTagMode: "all",
      }).map((entry) => entry.id),
    ).toEqual(["d"]);
    expect(
      filterItems(items, {
        query: "",
        faction: "all",
        tags: [],
        tagMode: "all",
        weaponTags: ["rocket", "laser"],
        weaponTagMode: "any",
      }).map((entry) => entry.id),
    ).toEqual(["d"]);
  });

  it("сортирует числом и направлением, имя — tie-breaker", () => {
    const items = [
      item({ id: "a", name: "Альфа", fullCost: 100 }),
      item({ id: "b", name: "Бета", fullCost: 300 }),
      item({ id: "c", name: "Гамма", fullCost: 100 }),
    ];
    expect(sortItems(items, "fullCost", "desc", "ru").map((entry) => entry.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortItems(items, "fullCost", "asc", "ru").map((entry) => entry.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("card stats", () => {
  it("считает полную стоимость и DPS с количеством пушек", () => {
    expect(fullCost(100, 40)).toBe(110);
    expect(weaponDps({ count: 2, damage: 10, fireDelay: 0.5 })).toBe(40);
    expect(
      filteredWeaponDps(
        [
          { count: 1, damage: 10, fireDelay: 1, tags: ["rocket", "anti-air"] },
          { count: 1, damage: 20, fireDelay: 2, tags: ["laser"] },
        ],
        ["rocket"],
        "all",
      ),
    ).toBe(10);
  });
});

describe("compare", () => {
  it("считает производные метрики и лучшие значения", () => {
    const a = item({
      id: "a",
      cost: 100,
      energy: 40,
      fullCost: 110,
      hp: 1000,
      shield: 100,
      dps: 100,
    });
    const b = item({ id: "b", cost: 200, energy: 0, fullCost: 200, hp: 1000, shield: 0, dps: 50 });
    expect(metricValue(a, "totalHp")).toBe(1100);
    expect(metricValue(item({ selfRegen: 3 }), "selfRegen")).toBe(3);
    expect(metricValue(item({ shieldRegen: 4 }), "shieldRegen")).toBe(4);
    expect(metricValue(a, "dpsPerFullCost")).toBeCloseTo((100 / 110) * 100);
    expect(metricValue(b, "totalHpPerFullCost")).toBe(500);
    expect(bestIndexes([100, 200, null], "lower")).toEqual([0]);
    expect(bestIndexes([100, 200, 100], "higher")).toEqual([1]);
    expect(bestIndexes([100, 100], "higher")).toEqual([]);
  });

  it("считает DPS по количеству и задержке орудий", () => {
    expect(
      withDerivedDps({
        id: "a",
        weapons: [
          { count: 2, damage: 10, fireDelay: 0.5 },
          { count: 1, damage: 5, fireDelay: 1 },
        ],
      }).dps,
    ).toBe(45);
    expect(withDerivedDps({ id: "b" }).dps).toBe(0);
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
    expect(encoded).toBe("units:a,b,c,d");
    expect(parseCompareParam(encoded, items)).toEqual({ tab: "units", ids: ["a", "b", "c", "d"] });
    expect(parseCompareParam("units:a,building", items)).toEqual({ tab: "units", ids: ["a"] });
    expect(parseCompareParam("bad:a", items)).toBeNull();
    expect(MAX_COMPARE).toBe(4);

    expect(serializeCardParam("units", "a")).toBe("units:a");
    expect(parseCardParam("units:a", items)).toEqual({ tab: "units", id: "a" });
    expect(parseCardParam("units:building", items)).toBeNull();
    expect(parseCardParam("bad:a", items)).toBeNull();
  });
});
