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
});
