import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  { name: "главная", path: "./" },
  { name: "статья вики", path: "wiki/lore/history/" },
  { name: "хаб вики", path: "wiki/" },
  { name: "база данных", path: "database/" },
];

for (const { name, path } of pages) {
  test(`a11y: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
