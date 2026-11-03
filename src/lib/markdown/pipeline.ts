/* ============================================================================
   WWN — единый markdown-пайплайн для Astro и preview в админке.
   Порядок плагинов и опции якорей живут в одном месте.
   ============================================================================ */

import type { RehypePlugins, RemarkPlugins } from "@astrojs/markdown-remark";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { rehypeArticleFeatures } from "./rehype-article";
import { rehypeAssetUrls } from "./rehype-asset-urls";
import { remarkWikiLinks } from "./remark-wiki-links";

export const AUTOLINK_HEADINGS_OPTIONS = {
  behavior: "append" as const,
  properties: { className: ["article__anchor"], tabIndex: 0 },
};

export const REMARK_PLUGINS: RemarkPlugins = [remarkWikiLinks];

export const REHYPE_PLUGINS: RehypePlugins = [
  rehypeSlug,
  [rehypeAutolinkHeadings, AUTOLINK_HEADINGS_OPTIONS],
  rehypeAssetUrls,
  rehypeArticleFeatures,
];
