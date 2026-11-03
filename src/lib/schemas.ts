/* ============================================================================
   WWN — Zod-схемы данных.
   Один источник правды: коллекции Astro (src/content.config.ts) и тесты.
   Текст без EN-перевода нормализуется в { ru, en: ru } на границе данных.
   ============================================================================ */

import { z } from "astro/zod";

import { BUILDING_TYPES, SECTION_ICONS, TAG_GROUPS, UNIT_TYPES } from "./content-constants.ts";

/** Локализованный текст: EN обязателен для потребителей, но в JSON может отсутствовать. */
const text = z
  .object({ ru: z.string().min(1), en: z.string().min(1).optional() })
  .transform((value) => ({ ru: value.ru, en: value.en ?? value.ru }));

export type Text = { ru: string; en: string };

const dateString = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.iso.date(),
);

export const wikiSchema = z.object({
  title: z.string().min(1),
  desc: z.string().min(1),
  order: z.number().int().positive(),
  updated: dateString,
  draft: z.boolean().default(false),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(SECTION_ICONS),
  order: z.number().int().positive(),
  title: text,
  desc: text,
});

const stat = z.number().nonnegative().optional();

const weaponSchema = z.object({
  name: text,
  damage: z.number().nonnegative(),
});

export type Weapon = z.infer<typeof weaponSchema>;

const cardBase = z.object({
  id: z.string().min(1),
  name: text,
  faction: z.string().min(1),
  desc: text,
  tags: z.array(z.string().min(1)),
  cost: z.number().nonnegative(),
  hp: z.number().nonnegative(),
  buildTime: z.number().nonnegative(),
  shield: stat,
  selfRegen: stat,
  shieldRegen: stat,
  dps: stat,
  weapons: z.array(weaponSchema).optional(),
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
  type: z.enum(UNIT_TYPES),
});

export const buildingSchema = cardBase.extend({
  type: z.enum(BUILDING_TYPES),
});

export type Unit = z.infer<typeof unitSchema>;
export type Building = z.infer<typeof buildingSchema>;

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
  group: z.enum(TAG_GROUPS),
});

export type Tag = z.infer<typeof tagSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type WikiFrontMatter = z.infer<typeof wikiSchema>;

export const statsSchema = z.object({
  maps: z.number().int().nonnegative(),
});
