/* ============================================================================
   rehype-плагин: пути к публичным ассетам из сырого HTML в Markdown.
   «../assets/audio/x.mp3» → /WWN.site/audio/x.mp3
   (картинки в Markdown обрабатывает image-пайплайн Astro — их не трогаем).
   ============================================================================ */

import type { Root } from "hast";
import { visit } from "unist-util-visit";

import { href } from "../site";

const ASSET = /^\.\.\/assets\/(.+)$/;

export function rehypeAssetUrls() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const isMedia =
        node.tagName === "audio" || node.tagName === "source" || node.tagName === "video";
      const isLink = node.tagName === "a";
      if (!isMedia && !isLink) return;

      const key = isLink ? "href" : "src";
      const value = node.properties?.[key];
      if (typeof value !== "string") return;
      const match = value.match(ASSET);
      if (match?.[1]) node.properties[key] = href(match[1]);
    });
  };
}
