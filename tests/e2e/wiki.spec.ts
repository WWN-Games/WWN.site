import { expect, test } from "@playwright/test";

test.describe("Вики", () => {
  test("RU-статья рендерится статически", async ({ page }) => {
    const response = await page.goto("wiki/lore/history/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("article.article h1")).toBeVisible();
    const body = await page.locator(".article__body").innerText();
    expect(body.length).toBeGreaterThan(500);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/wiki\/lore\/history\/$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      /\/en\/wiki\/lore\/history\/$/,
    );
  });

  test("EN-статья доступна на /en/", async ({ page }) => {
    await page.goto("en/wiki/lore/history/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("article.article h1")).toBeVisible();
  });

  test("хаб: разделы и сайдбар", async ({ page }) => {
    await page.goto("wiki/");
    await expect(page.locator("#wiki-cat-lore")).toBeVisible();
    await expect(page.locator("#wikiNav a").first()).toBeVisible();
    await expect(page.locator(".wiki-cat")).toHaveCount(5);
  });

  test("поиск открывается по Ctrl+K и находит статью", async ({ page }) => {
    await page.goto("wiki/");
    const panel = page.locator("#searchPanel");
    await expect
      .poll(async () => {
        await page.keyboard.press("Control+k");
        return panel.evaluate((el) => (el as HTMLDialogElement).open);
      })
      .toBe(true);
    await page.locator("#searchPanelInput").fill("Протон");
    await expect(page.locator("#searchResults a").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#searchResults")).toContainText(/Протон/);
  });

  test("черновики не собираются в продакшене", async ({ page }) => {
    const response = await page.goto("wiki/misc/markup/");
    expect(response?.status()).toBe(404);
  });
});
