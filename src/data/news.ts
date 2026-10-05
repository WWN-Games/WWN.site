/* ============================================================================
   WWN — новости главной (перенос из assets/js/site-data.js).
   ============================================================================ */

import type { Lang } from "../lib/site";

/** Текст на двух языках сайта: ru — основной, en — английский. */
export type LocalizedText = Record<Lang, string>;

export interface NewsItem {
  /** Дата в формате ISO YYYY-MM-DD. */
  date: string;
  /** id тега из newsTags. */
  tag: string;
  /** Внешняя (https://…) или внутренняя (wiki/<раздел>/<статья>/) ссылка: строкой либо { ru, en }. */
  link?: string | LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
}

/**
 * Доступные теги новостей: id + подпись в newsTagLabels.
 * Цвет задаётся классом .tag--<id> (для update отдельного класса нет — базовый .tag).
 */
export const newsTags: readonly string[] = ["update", "news"];

/** Подписи тегов новостей: id → { ru, en }. */
export const newsTagLabels: Record<string, LocalizedText> = {
  update: { ru: "Обновление", en: "Update" },
  news: { ru: "Новости", en: "News" },
};

export const news: readonly NewsItem[] = [
  {
    date: "2026-09-17",
    tag: "update",
    link: "wiki/",
    title: {
      ru: "Вики WWN: лор, фракции и гайды",
      en: "WWN wiki: lore, factions and guides",
    },
    text: {
      ru: "История галактики, фракции, юниты и руководства — в отдельном разделе сайта. Начни с обзора вселенной WWN.",
      en: "Galaxy history, factions, units and guides — in a dedicated section of the site. Start with the WWN universe overview.",
    },
  },
  {
    date: "2026-08-16",
    tag: "news",
    title: {
      ru: "Вселенной WWN исполняется 10 лет 🏆",
      en: "The WWN universe is turning 10 years old 🏆",
    },
    text: {
      ru: "С юбилеем, WWN!",
      en: "Happy Anniversary, WWN!",
    },
  },
];
