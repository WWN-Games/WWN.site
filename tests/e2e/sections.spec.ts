import { expect, test } from "@playwright/test";

test.describe("Новые разделы", () => {
  for (const path of ["news/", "rating/", "gallery/", "maps/", "videos/", "feats/"]) {
    test(`${path} открывается`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".header .nav")).toBeVisible();
    });
  }

  test("галерея показывает скриншоты", async ({ page }) => {
    await page.goto("gallery/");
    await expect(page.locator(".gallery__item").first()).toBeVisible();
  });

  test("новости вынесены на отдельную страницу", async ({ page }) => {
    await page.goto("news/");
    await expect(page.locator(".news__card")).toHaveCount(2);
  });
});
