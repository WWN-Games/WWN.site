/* ============================================================================
   WWN — сборка поискового индекса вики.
   ----------------------------------------------------------------------------
   Читает статьи из content/<язык>/ по списку data/wiki-nav.json и пишет
   data/search-index-<язык>.json (slug + текст без markdown и HTML).

   Запуск из корня репозитория:
     node tools/build-search-index.mjs
   ============================================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { stripMd } from "../assets/js/md-text.js";

const LANGS = ["ru", "en"];

const nav = JSON.parse(readFileSync("data/wiki-nav.json", "utf8"));
const slugs = (nav.categories || []).flatMap((category) =>
  (category.articles || []).map((article) => (typeof article === "string" ? article : article.slug))
);

if (!slugs.length) {
  console.error("wiki-nav.json: не нашлось ни одной статьи");
  process.exit(1);
}

for (const lang of LANGS) {
  const items = slugs.map((slug) => ({
    slug,
    text: stripMd(readFileSync(`content/${lang}/${slug}.md`, "utf8"))
  }));
  const file = `data/search-index-${lang}.json`;
  writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  console.log(`${file}: ${items.length} статей`);
}
