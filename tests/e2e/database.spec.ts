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

  test("поиск по токенам не зависит от порядка слов", async ({ page }) => {
    await page.goto("database/#units");
    const cards = page.locator("#databaseGrid-units [data-card-id]");
    await page.getByRole("searchbox").fill("пво лодка");
    await expect
      .poll(async () =>
        cards.evaluateAll((els) => els.filter((el) => !el.hasAttribute("hidden")).length),
      )
      .toBe(1);
    await expect(page.locator("#databaseGrid-units [data-card-id]:not([hidden])")).toHaveAttribute(
      "data-card-id",
      "ahaosa",
    );
  });

  test("очистка поиска отменяет отложенный запрос", async ({ page }) => {
    await page.goto("database/#units");
    const search = page.getByRole("searchbox");
    await search.fill("акула");
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await page.waitForTimeout(250);
    await expect(page.locator("#databaseGrid-units [data-card-id]:not([hidden])")).toHaveCount(110);
  });

  test("выбор карточек, tray и сравнение с сохранением URL", async ({ page }) => {
    await page.goto("database/#units");
    const first = page.locator('[data-compare-id="ahaosa"]');
    await expect(first).toBeVisible();
    await first.click();
    await page.locator('[data-compare-id="akula"]').click();

    const tray = page.locator(".compare-tray");
    await expect(tray).toBeVisible();
    await expect(tray.locator(".compare-tray__count")).toHaveText("Выбрано: 2 из 4");
    await expect(page.locator(".unit-card.is-compared")).toHaveCount(2);

    await page.getByRole("button", { name: /Сравнить \(2\)/ }).click();
    const dialog = page.locator(".compare-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".compare-table tbody tr")).not.toHaveCount(0);
    await expect(dialog.locator(".compare-table td.is-best").first()).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get("compare")).toBe("units:ahaosa,akula");
    expect(url.hash).toBe("#units");

    await page.reload();
    await expect(page.locator(".compare-dialog")).toBeVisible();
    await expect(page.locator('#databaseTabs [data-tab="units"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("лимит сравнения и удаление карточек", async ({ page }) => {
    await page.goto("database/#units");
    const buttons = page.locator("[data-compare-id]");
    for (let index = 0; index < 5; index += 1) await buttons.nth(index).click();
    await expect(page.locator(".compare-tray__count")).toHaveText("Выбрано: 4 из 4");
    await expect(page.locator(".database-explorer__notice")).toContainText("не более 4");

    await page.getByRole("button", { name: /Сравнить \(4\)/ }).click();
    await page.locator(".compare-cardhead__remove").first().click();
    await expect(page.locator(".compare-dialog")).toBeVisible();
    await page.locator(".compare-cardhead__remove").first().click();
    await page.locator(".compare-cardhead__remove").first().click();
    await expect(page.locator(".compare-dialog")).not.toBeVisible();
    await expect(page.locator(".compare-tray__count")).toHaveText("Выбрано: 1 из 4");
  });

  test("сравнение адаптировано под узкий экран", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("database/#units");
    await page.locator('[data-compare-id="ahaosa"]').click();
    await page.locator('[data-compare-id="akula"]').click();
    await page.getByRole("button", { name: /Сравнить \(2\)/ }).click();
    await expect(page.locator(".compare-dialog")).toBeVisible();
    await expect(page.locator(".compare-table-wrap")).toBeVisible();
    await expect(page.locator(".compare-dialog__close")).toBeVisible();
  });

  test("смена языка сохраняет выбранное сравнение", async ({ page }) => {
    await page.goto("database/#units");
    await page.locator('[data-compare-id="ahaosa"]').click();
    await page.locator('[data-compare-id="akula"]').click();
    await page.locator('.header .lang a[data-lang="en"]').click();
    await expect(page).toHaveURL(/\/en\/database\/\?compare=units%3Aahaosa%2Cakula#units/);
    await expect(page.locator(".compare-dialog")).toBeVisible();
    await expect(page.locator(".compare-tray__count")).toHaveText("Selected: 2 of 4");
  });
});
