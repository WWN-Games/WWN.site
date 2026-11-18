/* Общие подписи коллекций для клиента админки. */

import type { CollectionName } from "../../src/lib/content-constants.ts";

export interface CollectionMeta {
  title: string;
  singular: string;
  newLabel: string;
}

export const COLLECTION_META = {
  units: { title: "Юниты", singular: "юнит", newLabel: "Новый юнит" },
  buildings: { title: "Строения", singular: "строение", newLabel: "Новое строение" },
  misc: { title: "Разное", singular: "запись", newLabel: "Новая запись" },
  factions: { title: "Фракции", singular: "фракция", newLabel: "Новая фракция" },
  tags: { title: "Теги", singular: "тег", newLabel: "Новый тег" },
  sections: { title: "Разделы вики", singular: "раздел", newLabel: "Новый раздел" },
  maps: { title: "Карты", singular: "карта", newLabel: "Новая карта" },
  gallery: { title: "Галерея", singular: "скриншот", newLabel: "Новый скриншот" },
  videos: { title: "Видео", singular: "видео", newLabel: "Новое видео" },
  feats: { title: "Подвиги", singular: "подвиг", newLabel: "Новый подвиг" },
  news: { title: "Новости", singular: "новость", newLabel: "Новая новость" },
  ratings: { title: "Рейтинг", singular: "запись рейтинга", newLabel: "Новая запись" },
} as const satisfies Record<CollectionName, CollectionMeta>;

export type CardCollection = "units" | "buildings" | "misc";

export function isCardCollection(name: string): name is CardCollection {
  return name === "units" || name === "buildings" || name === "misc";
}
