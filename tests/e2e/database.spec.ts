import { expect, test } from "@playwright/test";

test.describe("База данных", () => {
  test("вкладки, фильтры и поиск", async ({ page }) => {
    await page.goto("database/");
    await expect(page.locator("#databaseTabs")).toBeVisible();

    await page.locator('#databaseTabs [data-tab="units"]').click();
    const cards = page.locator("#databaseGrid-units [data-card-id]");
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBe(110);

    await page.getByRole("searchbox").fill("Акула");
    await expect
      .poll(async () =>
        cards.evaluateAll((els) => els.filter((el) => !el.hasAttribute("hidden")).length),
      )
      .toBeLessThan(total);
  });

  test("deep-link на вкладку строений", async ({ page }) => {
    await page.goto("database/#buildings");
    await expect(page.locator('#databaseTabs [data-tab="buildings"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#databaseGrid-buildings [data-card-id]").first()).toBeVisible();
  });

  test("EN-версия", async ({ page }) => {
    await page.goto("en/database/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#databaseTabs")).toBeVisible();
  });

  test("порядок фракций: Фензем, Протон, затем остальные", async ({ page }) => {
    await page.goto("database/");
    const ids = await page
      .locator("#databaseGrid-factions [data-card-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));
    expect(ids).toEqual(["fenearth", "proton", "darkmarket", "bioforms", "aborigines", "neutrals"]);

    await page.locator('#databaseTabs [data-tab="units"]').click();
    const options = await page
      .locator(".database-explorer select")
      .first()
      .locator("option")
      .evaluateAll((els) => els.map((el) => el.getAttribute("value")));
    expect(options).toEqual([
      "all",
      "fenearth",
      "proton",
      "darkmarket",
      "bioforms",
      "aborigines",
      "neutrals",
    ]);
  });

  test("тег-панель открывается у кнопки, без прыжка из угла", async ({ page }) => {
    await page.goto("database/");
    await page.locator('#databaseTabs [data-tab="units"]').click();
    const button = page.locator('button[popovertarget="databaseTagPanel"]');
    await button.click();
    const panel = page.locator("#databaseTagPanel");
    await expect(panel).toBeVisible();
    const [panelBox, buttonBox] = await Promise.all([panel.boundingBox(), button.boundingBox()]);
    expect(panelBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(panelBox?.x ?? 0).toBeGreaterThan(0);
    expect(panelBox?.y ?? 0).toBeGreaterThan(0);
    expect(Math.abs((panelBox?.x ?? 0) - (buttonBox?.x ?? 0))).toBeLessThan(80);
  });
});
