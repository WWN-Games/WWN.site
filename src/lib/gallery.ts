/* ============================================================================
   WWN — галерея скриншотов: данные из коллекции gallery + картинки из
   src/assets/img/gallery. Резолв общий для главной и отдельной страницы.
   ============================================================================ */

import { getImage } from "astro:assets";
import { getCollection } from "astro:content";
import type { ImageMetadata } from "astro";

import type { Lang } from "./site";

const galleryImages = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/img/gallery/*.avif",
  { eager: true },
);

export interface ResolvedGalleryItem {
  id: string;
  image: ImageMetadata;
  caption: string;
  wide: boolean;
  lightboxSrc: string;
}

export async function loadGallery(lang: Lang, limit?: number): Promise<ResolvedGalleryItem[]> {
  const entries = (await getCollection("gallery"))
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .slice(0, limit);

  const resolved = await Promise.all(
    entries.map(async (entry): Promise<ResolvedGalleryItem | null> => {
      const image = galleryImages[`/src/${entry.data.image.replace(/^\/+/, "")}`];
      if (!image) return null;
      const lightbox = await getImage({
        src: image.default,
        width: Math.min(1240, image.default.width),
        format: "avif",
      });
      return {
        id: entry.id,
        image: image.default,
        caption: entry.data.caption[lang],
        wide: entry.data.wide,
        lightboxSrc: lightbox.src,
      };
    }),
  );

  return resolved.filter((item): item is ResolvedGalleryItem => item !== null);
}
