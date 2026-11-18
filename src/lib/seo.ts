/* ============================================================================
   WWN — JSON-LD для страниц-каталогов. Один формат для карт, новостей,
   рейтинга, видео и подвигов.
   ============================================================================ */

import { type Lang, localeHref, SITE } from "./site";

interface Options {
  lang: Lang;
  /** Путь без base и языка: "maps/". */
  path: string;
  title: string;
  description: string;
  count: number;
}

export function collectionJsonLd({ lang, path, title, description, count }: Options) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE}${localeHref(lang, path)}`,
    inLanguage: lang,
    mainEntity: { "@type": "ItemList", numberOfItems: count },
  };
}
