import { promises as fs } from "node:fs";
import path from "node:path";

import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

import type { Lang, PreviewResult } from "../shared/types.ts";
import { rehypeArticleFeatures } from "../../src/lib/markdown/rehype-article.ts";
import { rehypeAssetUrls } from "../../src/lib/markdown/rehype-asset-urls.ts";
import { remarkWikiLinks } from "../../src/lib/markdown/remark-wiki-links.ts";
import { SITE_BASE, SITE_DEV_URL, SITE_ROOT } from "./config.ts";
import { HttpError } from "./http.ts";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkWikiLinks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(
    rehypeAutolinkHeadings,
    {
      behavior: "append",
      properties: { className: ["article__anchor"], tabIndex: -1, ariaHidden: "true" },
    },
  )
  .use(rehypeAssetUrls)
  .use(rehypeArticleFeatures)
  .use(rehypeStringify, { allowDangerousHtml: true });

let cssPromise: Promise<string> | null = null;

function previewCss(): Promise<string> {
  cssPromise ??= (async () => {
    const [base, wiki] = await Promise.all([
      fs.readFile(path.join(SITE_ROOT, "src/styles/style.css"), "utf8"),
      fs.readFile(path.join(SITE_ROOT, "src/styles/wiki.css"), "utf8"),
    ]);
    return `${base}\n${wiki}\n
@font-face {
  font-family: "Onest";
  src: url("/media/assets/fonts/onest-wght.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Science Gothic";
  src: url("/media/assets/fonts/science-gothic-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  src: url("/media/assets/fonts/geist-mono-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
:root {
  --font-body: "Onest", system-ui, sans-serif;
  --font-display: "Science Gothic", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}
html, body { min-height: 0; }
body {
  padding: 28px 30px 48px;
  background: var(--bg-0);
  overflow-x: hidden;
}
.article__body { max-width: none; }
.article__body > :first-child { margin-top: 0; }
.preview-empty { color: var(--muted); font: 14px var(--font-body); }
`;
  })();
  return cssPromise;
}

function rewriteHtml(html: string): string {
  return html
    .replaceAll('src="../../../../assets/', 'src="/media/assets/')
    .replaceAll('src="../assets/', 'src="/media/public/')
    .replaceAll('src="/WWN.site/', 'src="/media/public/')
    .replaceAll('href="/WWN.site/', `href="${SITE_DEV_URL}/`)
    .replaceAll('href="../../../../assets/', 'href="/media/assets/')
    .replaceAll('href="../assets/', 'href="/media/public/');
}

export async function renderPreview(input: {
  lang: Lang;
  section: string;
  slug: string;
  body: string;
}): Promise<PreviewResult> {
  if (input.lang !== "ru" && input.lang !== "en") throw new HttpError(400, "Неизвестный язык");
  if (typeof input.body !== "string") throw new HttpError(400, "Нет текста статьи");

  const slug = input.slug || `${input.section}/preview`;
  const filePath = path.join(
    SITE_ROOT,
    "src/content/wiki",
    input.lang,
    `${slug}.md`,
  );

  let html: string;
  try {
    const file = new VFile({ value: input.body, path: filePath });
    const result = await processor.process(file);
    html = rewriteHtml(String(result));
  } catch (error) {
    throw new HttpError(400, "Не удалось отрендерить Markdown", [
      error instanceof Error ? error.message : String(error),
      "Проверьте ссылки и разметку.",
    ]);
  }

  const prefix = input.lang === "en" ? `${SITE_BASE}/en/wiki` : `${SITE_BASE}/wiki`;
  return {
    html,
    css: await previewCss(),
    sitePath: `${prefix}/${slug}/`,
  };
}
