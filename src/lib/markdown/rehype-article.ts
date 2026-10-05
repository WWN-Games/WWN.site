/* ============================================================================
   rehype-плагин: фичи оформления статей, потерянные при миграции.
   1. Внешние ссылки — новая вкладка + класс .wiki-link--external (стрелка ↗).
   2. Одиночные картинки → <figure class="article__figure"> с подписью из alt;
      группы картинок в абзаце → .article__gallery.
   3. Заголовки «Источники/См. также» и следующий список → .article__sources*.
   4. Сноски remark-gfm — локализация подписи и обратных ссылок (wiki.notes,
      wiki.refBack).
   ============================================================================ */

import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { t } from "../../i18n";
import type { Lang } from "../site";

const SOURCE_TITLES = new Set([
  "источники",
  "ссылки",
  "внешние ссылки",
  "см. также",
  "sources",
  "links",
  "external links",
  "see also",
  "references",
]);

function langOf(file: VFile): Lang {
  const relative = (file.path ?? "").split("/wiki/")[1];
  if (!relative) {
    throw new Error(`rehypeArticleFeatures: не удалось определить язык статьи для ${file.path}`);
  }
  return relative.startsWith("en/") ? "en" : "ru";
}

function textOf(node: Element): string {
  let text = "";
  visit(node, "text", (child) => {
    text += child.value;
  });
  return text.trim();
}

function addClass(node: Element, className: string): void {
  const existing = node.properties?.className;
  const classes = Array.isArray(existing) ? existing.map(String) : [];
  if (!classes.includes(className)) classes.push(className);
  if (node.properties) node.properties.className = classes;
}

export function rehypeArticleFeatures() {
  return (tree: Root, file: VFile) => {
    const lang = langOf(file);

    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return;
      node.properties.target = "_blank";
      node.properties.rel = ["noopener"];
      addClass(node, "wiki-link--external");
    });

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "p" || !parent || typeof index !== "number") return;
      const images = node.children.filter(
        (child): child is Element => child.type === "element" && child.tagName === "img",
      );
      if (!images.length) return;
      const hasOtherContent = node.children.some((child) => {
        if (child.type === "text") return child.value.trim() !== "";
        return !(child.type === "element" && child.tagName === "img");
      });
      if (hasOtherContent) return;

      if (images.length === 1) {
        const image = images[0];
        if (!image) return;
        const alt = typeof image.properties?.alt === "string" ? image.properties.alt : "";
        const children: ElementContent[] = [image];
        if (alt) {
          children.push({
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: [{ type: "text", value: alt }],
          });
        }
        parent.children[index] = {
          type: "element",
          tagName: "figure",
          properties: { className: ["article__figure"] },
          children,
        };
      } else {
        addClass(node, "article__gallery");
      }
    });

    visit(tree, "element", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      if (!SOURCE_TITLES.has(textOf(node).toLowerCase())) return;
      addClass(node, "article__sources-title");
      const next = parent.children[index + 1];
      if (next?.type === "element" && (next.tagName === "ul" || next.tagName === "ol")) {
        addClass(next, "article__sources");
      }
    });

    visit(tree, "element", (node) => {
      if (node.tagName !== "section" || node.properties?.dataFootnotes === undefined) return;
      const label = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "h2",
      );
      if (label) label.children = [{ type: "text", value: t(lang, "wiki.notes") }];
      visit(node, "element", (link) => {
        if (link.tagName !== "a" || link.properties?.dataFootnoteBackref === undefined) return;
        link.properties.ariaLabel = t(lang, "wiki.refBack");
      });
    });
  };
}
