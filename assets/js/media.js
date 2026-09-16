/* ============================================================================
   WWN — адаптивные изображения (ES-модуль)
   Читает манифест assets/js/media-manifest.js и подставляет
   srcset/sizes/width/height, чтобы браузер грузил нужный размер без CLS.
   ============================================================================ */

import { MEDIA } from "./media-manifest.js";
import { abs } from "./utils.js";

const mediaByHref = new Map(
  Object.entries(MEDIA).map(([key, value]) => [abs(key), { key, ...value }])
);

function entryFor(src) {
  if (!src) return null;
  try {
    return mediaByHref.get(new URL(src, document.baseURI).href) ?? null;
  } catch {
    return null;
  }
}

/** Данные для srcset/sizes/размеров конкретной картинки. */
function imageData(src) {
  const entry = entryFor(src);
  if (!entry) return null;
  const parts = entry.variants.map((w) => `${abs(entry.key.replace(/\.webp$/, `-${w}.webp`))} ${w}w`);
  parts.push(`${abs(entry.key)} ${entry.w}w`);
  return {
    src: abs(entry.key),
    srcset: parts.join(", "),
    width: entry.w,
    height: entry.h
  };
}

/** Применить манифест к готовому <img>. */
export function applyResponsiveImage(img, src, sizes) {
  const data = imageData(src);
  if (!data) {
    img.src = src;
    return;
  }
  img.src = data.src;
  img.srcset = data.srcset;
  if (sizes) img.sizes = sizes;
  if (!img.hasAttribute("width")) img.width = data.width;
  if (!img.hasAttribute("height")) img.height = data.height;
}

/** Обход всех <img> внутри контейнера (для отрендеренного markdown). */
export function applyResponsiveImages(root, sizes) {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !/^(https?:)?\/\//i.test(src)) applyResponsiveImage(img, src, sizes);
  });
}
