/* ============================================================================
   remark-плагин: внутренние .md-ссылки → реальные URL вики.
   «../lore/history.md» → /WWN.site/wiki/lore/history/
   «proton.md»          → /WWN.site/wiki/factions/proton/ (внутри раздела)
   EN-контент ведёт на /en/wiki/....
   ============================================================================ */

import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { href } from "../site";

const MD_LINK = /^(.+?)\.md(#.*)?$/i;

export function remarkWikiLinks() {
  return (tree: Root, file: VFile) => {
    const filePath = file.path ?? "";
    const relative = filePath.split("/wiki/")[1];
    if (!relative) {
      throw new Error(`remarkWikiLinks: не удалось определить язык статьи для ${filePath}`);
    }
    const [lang, ...rest] = relative.split("/");
    if (lang !== "ru" && lang !== "en") {
      throw new Error(`remarkWikiLinks: неизвестный язык в пути ${filePath}`);
    }
    const dir = rest.slice(0, -1).join("/");

    visit(tree, "link", (node) => {
      if (
        /^[a-z][a-z0-9+.-]*:/i.test(node.url) ||
        node.url.startsWith("#") ||
        node.url.startsWith("/")
      ) {
        return;
      }
      const match = node.url.match(MD_LINK);
      if (!match) return;
      const target = new URL(match[1] ?? "", `https://wwn.local/content/${lang}/${dir}/article.md`);
      const slug = target.pathname.replace(`/content/${lang}/`, "");
      node.url = href(`${lang === "en" ? "en/" : ""}wiki/${slug}/${match[2] ?? ""}`);
    });
  };
}
