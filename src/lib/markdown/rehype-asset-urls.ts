/* ============================================================================
   rehype-плагин: пути к публичным ассетам из сырого HTML в Markdown.
   «../assets/audio/x.mp3» → /WWN.site/audio/x.mp3
   Сырой HTML без rehype-raw остаётся raw-узлами, поэтому обходим оба вида.
   (картинки в Markdown обрабатывает image-пайплайн Astro — их не трогаем).
   ============================================================================ */

import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

import { href } from "../site";

const ASSET = /^\.\.\/assets\/(.+)$/;
const RAW_ATTR = /(src|href)="(\.\.\/assets\/[^"]+)"/g;

function rewrite(value: string): string {
  const match = value.match(ASSET);
  return match?.[1] ? href(match[1]) : value;
}

export function rehypeAssetUrls() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const isMedia =
        node.tagName === "audio" || node.tagName === "source" || node.tagName === "video";
      const isLink = node.tagName === "a";
      if (!isMedia && !isLink) return;

      const key = isLink ? "href" : "src";
      const value = node.properties?.[key];
      if (typeof value === "string") node.properties[key] = rewrite(value);
    });

    visit(tree, "raw", (node) => {
      const raw = node as unknown as { value: string };
      raw.value = raw.value.replace(
        RAW_ATTR,
        (_match: string, attr: string, path: string) => `${attr}="${rewrite(path)}"`,
      );
    });
  };
}
