/* ============================================================================
   WWN — конфигурация Astro 7
   Статическая сборка для GitHub Pages (base: /WWN.site).
   ============================================================================ */

import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import { defineConfig, fontProviders } from "astro/config";
import pagefind from "astro-pagefind";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { rehypeAssetUrls } from "./src/lib/markdown/rehype-asset-urls";
import { remarkWikiLinks } from "./src/lib/markdown/remark-wiki-links";
import { BASE, SITE } from "./src/lib/site";

// Те же unicode-range, что были в fonts.css: latin/cyrillic-сабсеты.
const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

export default defineConfig({
  site: SITE,
  base: BASE,
  output: "static",
  trailingSlash: "always",

  i18n: {
    locales: ["ru", "en"],
    defaultLocale: "ru",
    routing: { prefixDefaultLocale: false },
  },

  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "ru",
        locales: { ru: "ru-RU", en: "en-US" },
      },
    }),
    svelte(),
    pagefind(),
  ],

  prefetch: { prefetchAll: true, defaultStrategy: "hover" },

  markdown: {
    processor: unified({
      remarkPlugins: [remarkGfm, remarkWikiLinks],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            properties: { className: ["article__anchor"], tabIndex: -1, ariaHidden: "true" },
          },
        ],
        rehypeAssetUrls,
      ],
    }),
    shikiConfig: { theme: "github-dark" },
  },

  fonts: [
    {
      provider: fontProviders.local(),
      name: "Onest",
      cssVariable: "--font-body",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: ["./src/assets/fonts/onest-wght.woff2"],
            display: "swap",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Geist Mono",
      cssVariable: "--font-mono",
      fallbacks: ["ui-monospace", "monospace"],
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: ["./src/assets/fonts/geist-mono-latin.woff2"],
            unicodeRange: [LATIN],
            display: "swap",
          },
          {
            weight: "100 900",
            style: "normal",
            src: ["./src/assets/fonts/geist-mono-cyrillic.woff2"],
            unicodeRange: [CYRILLIC],
            display: "swap",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Science Gothic",
      cssVariable: "--font-display",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            weight: "100 900",
            style: "normal",
            src: ["./src/assets/fonts/science-gothic-latin.woff2"],
            unicodeRange: [LATIN],
            display: "swap",
          },
          {
            weight: "100 900",
            style: "normal",
            src: ["./src/assets/fonts/science-gothic-cyrillic.woff2"],
            unicodeRange: [CYRILLIC],
            display: "swap",
          },
        ],
      },
    },
  ],

  vite: {
    css: { transformer: "lightningcss" },
  },

  image: {
    service: { entrypoint: "./src/lib/image-service.ts" },
  },

  compressHTML: true,
});
