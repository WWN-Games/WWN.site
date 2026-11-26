/* ============================================================================
   WWN — Zod-схемы данных.
   Один источник правды: коллекции Astro (src/content.config.ts) и тесты.
   Текст без EN-перевода нормализуется в { ru, en: ru } на границе данных.
   ============================================================================ */

import { z } from "astro/zod";

import { SECTION_ICONS, TAG_GROUPS, UNLOAD_OPTIONS } from "./content-constants.ts";

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
  new: z.boolean().optional(),
  newUntil: dateString.optional(),
});

export const sectionSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(SECTION_ICONS),
  order: z.number().int().positive(),
  title: text,
  desc: text,
  /** Показывать раздел на хабе даже без опубликованных статей. */
  showEmpty: z.boolean().optional(),
});

const stat = z.number().nonnegative().optional();

const weaponSchema = z.object({
  name: text,
  /** Количество одинаковых орудий; DPS умножается на это число. */
  count: z.number().int().positive().default(1),
  /** Снарядов за один выстрел; DPS умножается на это число. */
  projectileCount: z.number().int().positive().default(1),
  /** Пауза между снарядами залпа в секундах; в DPS не входит. */
  projectileDelay: z.number().nonnegative().default(0),
  /** Урон одного снаряда. */
  damage: z.number().nonnegative(),
  /** Задержка между выстрелами в секундах. */
  fireDelay: z.number().positive(),
  /** Основное орудие: его ДПС идёт в основной ДПС карточки. */
  mainDps: z.boolean().default(false),
  /** Бронебойность снаряда. */
  armourIgnoreAmount: z.number().nonnegative().optional(),
  /** Теги из групп weapon и sector. */
  tags: z.array(z.string().min(1)).default([]),
  spread: z.number().nonnegative().optional(),
  splashRadius: z.number().nonnegative().optional(),
  stunDuration: z.number().nonnegative().optional(),
});

export type Weapon = z.infer<typeof weaponSchema>;

const builderSchema = z.object({
  buildRange: z.number().nonnegative(),
  repairSpeed: z.number().nonnegative(),
  buildSpeed: z.number().nonnegative(),
  /** Обычные теги карточек: кого лечит/чинит. */
  healTags: z.array(z.string().min(1)).default([]),
});

export type Builder = z.infer<typeof builderSchema>;

const factorySchema = z.object({
  name: text,
  buildSpeed: z.number().positive(),
  /** id юнитов, которые производит завод. */
  producedUnits: z.array(z.string().min(1)).default([]),
});

export type Factory = z.infer<typeof factorySchema>;

const transportSchema = z.object({
  name: text,
  seats: z.number().int().nonnegative().default(0),
  /** Обычные теги: кого можно перевозить. */
  cargoTags: z.array(z.string().min(1)).default([]),
  unload: z.array(z.enum(UNLOAD_OPTIONS)).default([]),
});

export type Transport = z.infer<typeof transportSchema>;

/** Активная защита: максимум зарядов и время восстановления одного заряда, с. */
const chargeDefenseSchema = z.object({
  max: z.number().int().nonnegative(),
  recharge: z.number().nonnegative(),
});

export type ChargeDefense = z.infer<typeof chargeDefenseSchema>;

const domeShieldSchema = z.object({
  radius: z.number().nonnegative(),
  points: z.number().nonnegative(),
  regen: z.number().nonnegative(),
});

export type DomeShield = z.infer<typeof domeShieldSchema>;

const atmosphereSchema = z.object({
  time: z.number().nonnegative(),
});

export type Atmosphere = z.infer<typeof atmosphereSchema>;

export const FTL_JUMP_TYPES = ["siv", "plasma", "tele"] as const;
export type FtlJumpType = (typeof FTL_JUMP_TYPES)[number];

const ftlJumpSchema = z.object({
  type: z.enum(FTL_JUMP_TYPES),
  chargeTime: z.number().nonnegative(),
  cooldown: z.number().nonnegative(),
  minDistance: z.number().nonnegative(),
  /** Скорость в прыжке; актуальна для СИВ. */
  jumpSpeed: z.number().nonnegative().optional(),
  /** Стоимость энергии; актуальна для плазменного прыжка. */
  energyCost: z.number().nonnegative().optional(),
});

export type FtlJump = z.infer<typeof ftlJumpSchema>;

const cardBase = z.object({
  id: z.string().min(1),
  name: text,
  faction: z.string().min(1),
  desc: text,
  tags: z.array(z.string().min(1)),
  cost: z.number().nonnegative(),
  /** Энергия обязательна; для карточек без энергии пишется 0. */
  energy: z.number().nonnegative(),
  hp: z.number().nonnegative(),
  buildTime: z.number().nonnegative(),
  shield: stat,
  armor: stat,
  selfRegen: stat,
  shieldRegen: stat,
  speed: stat,
  turnSpeed: stat,
  range: stat,
  weapons: z.array(weaponSchema).optional(),
  /** Защита от ракет: максимум зарядов и время восстановления 1 заряда (с). */
  missileDefense: chargeDefenseSchema.optional(),
  /** Защита от торпед: максимум зарядов и время восстановления 1 заряда (с). */
  torpedoDefense: chargeDefenseSchema.optional(),
  /** Лазерная защита: те же параметры, что у купольного щита. */
  laserDefense: domeShieldSchema.optional(),
  /** Купольный щит: радиус, очки защиты и восстановление (очков/с). */
  domeShield: domeShieldSchema.optional(),
  /** Способность входить в атмосферу: время в секундах. */
  atmosphere: atmosphereSchema.optional(),
  /** Простые способности-метки без параметров. */
  tacticalInstallation: z.boolean().optional(),
  nuclearInstallation: z.boolean().optional(),
  hyperInstallation: z.boolean().optional(),
  tacticalMissileDefense: z.boolean().optional(),
  nuclearMissileDefense: z.boolean().optional(),
  hyperMissileDefense: z.boolean().optional(),
  /** Сверхсветовой прыжок. */
  ftlJump: ftlJumpSchema.optional(),
  builder: builderSchema.optional(),
  factories: z.array(factorySchema).optional(),
  transports: z.array(transportSchema).optional(),
  image: z.string().optional(),
  /** Дополнительная маленькая иконка карточки (необязательная). */
  miniIcon: z.string().optional(),
  role: text.optional(),
  strongVs: z.union([z.array(z.string()), text]).optional(),
  weakVs: z.union([z.array(z.string()), text]).optional(),
  draft: z.boolean().optional(),
  new: z.boolean().optional(),
  /** Дата, до которой действует плашка «Новинка!». */
  newUntil: dateString.optional(),
});

export const unitSchema = cardBase;
export const buildingSchema = cardBase;
export const miscSchema = cardBase;

export type Unit = z.infer<typeof unitSchema>;
export type Building = z.infer<typeof buildingSchema>;
export type Misc = z.infer<typeof miscSchema>;

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

/* — новости и рейтинг — */

const NEWS_TAGS = ["update", "news"] as const;
export type NewsTag = (typeof NEWS_TAGS)[number];

export const newsSchema = z.object({
  id: z.string().min(1),
  date: dateString,
  tag: z.enum(NEWS_TAGS),
  /** Внешняя ссылка или локальный путь; можно задать отдельно для RU/EN. */
  link: z.union([z.string().min(1), text]).optional(),
  title: text,
  text: text,
  /** Закрепить на главной. */
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  order: z.number().int().nonnegative().default(0),
});

export type NewsItem = z.infer<typeof newsSchema>;

export const ratingSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  rating: z.number(),
});

export type RatingEntry = z.infer<typeof ratingSchema>;

/* — карты, галерея, видео и подвиги — */

export const mapSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  name: text,
  desc: text,
  /** Путь относительно public/; по умолчанию img/maps/<id>.avif. */
  image: z.string().optional(),
  players: z.number().int().positive().optional(),
  size: text.optional(),
  mode: text.optional(),
  author: text.optional(),
  /** Ссылка на скачивание или страницу карты. */
  download: z.string().min(1).optional(),
  new: z.boolean().optional(),
  newUntil: dateString.optional(),
});

export type MapItem = z.infer<typeof mapSchema>;

export const gallerySchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  /** Путь относительно src/: assets/img/gallery/<file>. */
  image: z.string().min(1),
  caption: text,
  wide: z.boolean().default(false),
});

export type GalleryItemData = z.infer<typeof gallerySchema>;

const VIDEO_LANGS = ["ru", "en"] as const;

export const videoSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
  lang: z.enum(VIDEO_LANGS),
  title: text,
  desc: text.optional(),
  date: dateString.optional(),
});

export type VideoItem = z.infer<typeof videoSchema>;

export const FEAT_TYPES = ["unit", "battle"] as const;
export type FeatType = (typeof FEAT_TYPES)[number];

export const featSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  name: text,
  desc: text,
  /** Путь относительно public/; по умолчанию img/feats/<id>.avif. */
  image: z.string().optional(),
  date: dateString.optional(),
  new: z.boolean().optional(),
  newUntil: dateString.optional(),
  /** Подвиг одного юнита или битвы. */
  type: z.enum(FEAT_TYPES).default("unit"),
  /** Командир — запись из ratings.json. */
  commanderId: z.string().min(1).optional(),
  /** Связанные юниты из units.json. */
  unitIds: z.array(z.string().min(1)).default([]),
  /** Ручное переопределение цены юнита; иначе сумма полной стоимости unitIds. */
  cost: z.number().nonnegative().optional(),
  destroyedCost: z.number().nonnegative().optional(),
  destroyedCount: z.number().int().nonnegative().optional(),
  combatNumber: z.string().optional(),
  heroLossCost: z.number().nonnegative().optional(),
  enemyLossCost: z.number().nonnegative().optional(),
  heroLossCount: z.number().int().nonnegative().optional(),
  enemyLossCount: z.number().int().nonnegative().optional(),
});

export type FeatItem = z.infer<typeof featSchema>;
