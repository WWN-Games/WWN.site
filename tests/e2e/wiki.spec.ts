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

  test("картинки в статье получают figure и подпись", async ({ page }) => {
    await page.goto("wiki/lore/history/");
    const figure = page.locator("article.article figure.article__figure").first();
    await expect(figure).toBeVisible();
    await expect(figure.locator("figcaption")).not.toBeEmpty();
  });

  test("внешние ссылки открываются в новой вкладке", async ({ page }) => {
    await page.goto("wiki/start/installation/");
    const external = page.locator("article.article a.wiki-link--external").first();
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", /noopener/);
  });

  test("аудио в статье отдаётся по абсолютному URL", async ({ page, request }) => {
    await page.goto("wiki/factions/fenearth/");
    const audio = page.locator("audio").first();
    await expect(audio).toHaveAttribute("src", /\/WWN\.site\/audio\/fenearth-anthem\.mp3$/);
    const response = await request.get("audio/fenearth-anthem.mp3");
    expect(response.status()).toBe(200);
  });
});
