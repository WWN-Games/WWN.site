/* ============================================================================
   WWN — конфигурация проекта: версия мода и внешние ссылки.
   ============================================================================ */

export const WWN_VERSION = "1.1.6";

const YOUTUBE_EN = "https://www.youtube.com/@shykinc4860";
const YOUTUBE_RU = "https://www.youtube.com/@%D0%92%D0%B0%D1%88%D0%B8%D0%B0%D0%BD";

export const LINKS = {
  steam: "https://steamcommunity.com/sharedfiles/filedetails/?id=3247893564",
  drive: "https://drive.google.com/file/d/1a3r6f3GG2pORNaqzCVBrsTKvrXs_ctYg/view?usp=sharing",
  discord: "https://discord.gg/sRwKDGrbDy",
  youtubeEn: YOUTUBE_EN,
  youtubeRu: YOUTUBE_RU,
} as const;

export function youtubeFor(lang: "ru" | "en"): string {
  return lang === "ru" ? LINKS.youtubeRu : LINKS.youtubeEn;
}
