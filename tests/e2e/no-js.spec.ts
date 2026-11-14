import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test.describe("Без JavaScript", () => {
  test("главная показывает контент и ответы FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#newsGrid .news__card")).toHaveCount(2);
    await expect(page.locator("#faq .faq__a").first()).toBeVisible();
  });

  test("база показывает юнитов и строения", async ({ page }) => {
    await page.goto("database/");
    await expect(page.locator("#databaseGrid-units")).toBeVisible();
    await expect(page.locator("#databaseGrid-buildings")).toBeVisible();
    await expect(page.locator("#databaseGrid-misc")).toBeVisible();
  });
});
