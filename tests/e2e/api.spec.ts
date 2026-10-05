import { expect, test } from "@playwright/test";

test.describe("Публичный API", () => {
  test("units.json отдаёт данные и схему", async ({ request }) => {
    const response = await request.get("api/v1/units.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const payload = await response.json();
    expect(payload.schemaVersion).toBe(1);
    expect(payload.count).toBe(110);
    expect(payload.items).toHaveLength(110);
    expect(payload.items[0]).toHaveProperty("id");
    expect(payload.items[0]).toHaveProperty("name");
  });

  test("манифест перечисляет эндпоинты", async ({ request }) => {
    const response = await request.get("api/v1/index.json");
    expect(response.status()).toBe(200);
    const payload = await response.json();
    const ids = payload.items.map((item: { id: string }) => item.id).sort();
    expect(ids).toEqual(["buildings", "factions", "stats", "tags", "units"]);
  });

  test("stats.json согласован с данными", async ({ request }) => {
    const [stats, units, buildings, factions] = await Promise.all([
      request.get("api/v1/stats.json").then((r) => r.json()),
      request.get("api/v1/units.json").then((r) => r.json()),
      request.get("api/v1/buildings.json").then((r) => r.json()),
      request.get("api/v1/factions.json").then((r) => r.json()),
    ]);
    const value = (id: string) =>
      stats.items.find((item: { id: string; value: number }) => item.id === id)?.value;
    expect(value("cards")).toBe(units.count + buildings.count);
    expect(value("factions")).toBe(factions.count);
  });
});
