import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const unitsData = JSON.parse(readFileSync(path.resolve("src/data/units.json"), "utf8")) as {
  units: unknown[];
};

test.describe("Публичный API", () => {
  test("units.json отдаёт данные и схему", async ({ request }) => {
    const response = await request.get("api/v1/units.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const payload = await response.json();
    expect(payload.schemaVersion).toBe(3);
    expect(payload.count).toBe(unitsData.units.length);
    expect(payload.items).toHaveLength(unitsData.units.length);
    expect(payload.items[0]).toHaveProperty("id");
    expect(payload.items[0]).toHaveProperty("name");
    expect(payload.items[0]).toHaveProperty("energy");
    expect(payload.items[0]).toHaveProperty("fullCost");
  });

  test("манифест перечисляет эндпоинты", async ({ request }) => {
    const response = await request.get("api/v1/index.json");
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const ids = payload.items.map((item: { id: string }) => item.id).sort();
    expect(ids).toEqual(["buildings", "factions", "maps", "misc", "stats", "tags", "units"]);
  });

  test("stats.json согласован с данными", async ({ request }) => {
    const [stats, units, buildings, misc, factions, maps] = await Promise.all([
      request.get("api/v1/stats.json").then((r) => r.json()),
      request.get("api/v1/units.json").then((r) => r.json()),
      request.get("api/v1/buildings.json").then((r) => r.json()),
      request.get("api/v1/misc.json").then((r) => r.json()),
      request.get("api/v1/factions.json").then((r) => r.json()),
      request.get("api/v1/maps.json").then((r) => r.json()),
    ]);
    const value = (id: string) =>
      stats.items.find((item: { id: string; value: number }) => item.id === id)?.value;
    expect(value("cards")).toBe(units.count + buildings.count + misc.count);
    expect(value("factions")).toBe(factions.count);
    expect(value("maps")).toBe(maps.count);
  });
});
