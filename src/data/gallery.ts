/* ============================================================================
   WWN — галерея главной.
   Картинки лежат в src/assets/img/gallery; src — только имя файла.
   ============================================================================ */

import type { LocalizedText } from "./news";

interface GalleryItem {
  /** Имя файла из src/assets/img/gallery, например "screenshot-1.avif". */
  src: string;
  caption: LocalizedText;
  /** Карточка шириной в 2 колонки. */
  wide?: boolean;
  /** Карточка высотой в 2 строки. */
  tall?: boolean;
}

export const gallery: readonly GalleryItem[] = [
  {
    src: "screenshot-1.avif",
    wide: true,
    caption: { ru: "Ядерный удар", en: "Nuclear strike" },
  },
  {
    src: "screenshot-2.avif",
    caption: { ru: "Фензем юниты", en: "Fenearth units" },
  },
  {
    src: "screenshot-3.avif",
    caption: { ru: "Протон юниты", en: "Proton units" },
  },
];
