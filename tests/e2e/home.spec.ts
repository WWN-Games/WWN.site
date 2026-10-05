import { expect, test } from "@playwright/test";

test.describe("Главная", () => {
  test("RU: секции, язык, ссылки", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page).toHaveTitle(/WWN/);
    await expect(page.locator("#mainNav")).toBeVisible();
    for (const id of ["features", "factions", "gallery", "download", "faq"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator("#newsGrid .news__card")).toHaveCount(2);
    await expect(page.locator("#galleryGrid .gallery__item")).toHaveCount(3);
    await expect(page.locator('a[href*="steamcommunity.com"]').first()).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  test("счётчики статистики анимируются до data-target", async ({ page }) => {
    await page.goto("./");
    const counter = page.locator(".hero__stats .stat__num").first();
    const target = await counter.getAttribute("data-target");
    expect(target).not.toBeNull();
    const expected = new Intl.NumberFormat("ru-RU").format(Number(target));
    await expect
      .poll(async () => (await counter.textContent())?.trim(), { timeout: 5000 })
      .toBe(expected);
  });

  test("EN: главная на /en/", async ({ page }) => {
    await page.goto("en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(/WWN/);
    await expect(page.locator("#features")).toBeVisible();
  });

  test("переключатель языка ведёт на локализованный URL", async ({ page }) => {
    await page.goto("wiki/lore/history/");
    await page.locator('.header .lang a[data-lang="en"]').click();
    await expect(page).toHaveURL(/\/en\/wiki\/lore\/history\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("preload только двух шрифтовых файлов", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
    await page.goto("en/");
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
  });

  test("подключены Onest (текст) и Geist Mono (моно)", async ({ page }) => {
    await page.goto("./");
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toContain("Onest");
    const monoFont = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono"),
    );
    expect(monoFont).toContain("Geist Mono");
  });

  test("лайтбокс открывается кликом и закрывается Escape", async ({ page }) => {
    await page.goto("./");
    const item = page.locator("#galleryGrid .gallery__item").first();
    const lightbox = page.locator("#lightbox");
    await expect
      .poll(async () => {
        await item.click();
        return lightbox.evaluate((el) => (el as HTMLDialogElement).open);
      })
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();
  });

  test("навигация между страницами переживает View Transitions", async ({ page }) => {
    await page.goto("./");
    await page.locator('#mainNav a[href$="/wiki/"]').click();
    await expect(page).toHaveURL(/\/wiki\/$/);
    await expect(page.locator("#wikiNav")).toBeVisible();
    await page.locator("#wikiNav a").first().click();
    await expect(page.locator("article.article h1")).toBeVisible();
  });

  test("FAQ раскрывается", async ({ page }) => {
    await page.goto("./");
    const question = page.locator(".faq__q").first();
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".faq__item").first()).toHaveClass(/is-open/);
  });
});
