/* ============================================================================
   WWN — разбор markdown для текстовых нужд (поиск, индексы).
   Чистые функции без DOM: используются и в браузере (wiki-shell.js),
   и при сборке поискового индекса (tools/build-search-index.mjs).
   ============================================================================ */

/** Front matter статьи: { meta, body }. */
export function parseFrontMatter(raw) {
  const meta = {};
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { meta, body: raw };
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value === "true" ? true : value === "false" ? false : value;
  });
  return { meta, body: raw.slice(match[0].length) };
}

/** Текст статьи без markdown и HTML — для поискового индекса и сниппетов.
    Дефисы внутри слов сохраняются: «Капо-Нантской» остаётся одним словом. */
export const stripMd = (markdown) =>
  parseFrontMatter(markdown).body
    .replace(/^\[\^[\w.-]+\]:[ \t]*/gm, "")
    .replace(/\[\^[\w.-]+\]/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "")
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, " ")
    .replace(/[*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
