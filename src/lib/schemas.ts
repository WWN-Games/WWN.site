/* ============================================================================
   WWN — Zod-схемы данных.
   Один источник правды: коллекции Astro (src/content.config.ts) и тесты.
   Текст без EN-перевода нормализуется в { ru, en: ru } на границе данных.
   ============================================================================ */

import { z } from "astro/zod";

/** Локализованный текст: EN обязателен для потребителей, но в JSON может отсутствовать. */
const text = z
  .object({ ru: z.string().min(1), en: z.string().min(1).optional() })
  .transform((value) => ({ ru: value.ru, en: value.en ?? value.ru }));

export type Text = { ru: string; en: string };

export const wikiSchema = z.object({
  title: z.string().min(1),
  desc: z.string().min(1),
  order: z.number().int().positive(),
  updated: z.coerce.date(),
  draft: z.boolean().default(false),
});

export type WikiData = z.infer<typeof wikiSchema>;

export const sectionIcons = [
  "book",
  "shield",
  "cube",
  "gear",
  "compass",
  "users",
  "clock",
  "rocket",
  "chat",
] as const;

export const sectionSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(sectionIcons),
  order: z.number().int().positive(),
  title: text,
  desc: text,
});

export type Section = z.infer<typeof sectionSchema>;

const stat = z.number().optional();

const cardBase = z.object({
  id: z.string().min(1),
  name: text,
  faction: z.string().min(1),
  desc: text,
  tags: z.array(z.string().min(1)),
  cost: z.number(),
  hp: z.number(),
  buildTime: z.number(),
  shield: stat,
  dps: stat,
  speed: stat,
  range: stat,
  image: z.string().optional(),
  role: text.optional(),
  strongVs: z.union([z.array(z.string()), text]).optional(),
  weakVs: z.union([z.array(z.string()), text]).optional(),
  draft: z.boolean().optional(),
  new: z.boolean().optional(),
});

export const unitSchema = cardBase.extend({
  type: z.enum(["ground", "air", "naval", "space", "support"]),
});

export const buildingSchema = cardBase.extend({
  type: z.enum(["economy", "defense", "structure"]),
});

export type Unit = z.infer<typeof unitSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type Card = Unit | Building;

export const factionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  name: text,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  emblem: z.string().min(1),
  lore: z.string().min(1),
  desc: text,
  motto: text.optional(),
  playstyle: text.optional(),
  specialty: text.optional(),
  strengths: z.object({ ru: z.array(z.string()), en: z.array(z.string()) }).optional(),
  weaknesses: z.object({ ru: z.array(z.string()), en: z.array(z.string()) }).optional(),
  subfaction: z.union([z.boolean(), z.string().min(1)]).optional(),
});

export type Faction = z.infer<typeof factionSchema>;

export const tagSchema = z.object({
  id: z.string().min(1),
  name: text,
  group: z.enum(["tier", "class", "movement", "mod"]),
});

export type Tag = z.infer<typeof tagSchema>;

export const statsSchema = z.object({
  maps: z.number().int().nonnegative(),
});
