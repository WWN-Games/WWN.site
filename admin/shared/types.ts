/* Общие типы клиента и сервера локальной админки.
   Доменные типы берутся из Zod-схем сайта, чтобы админка и контент
   не расходились. Здесь остаются только DTO самого интерфейса. */

import type { CollectionName } from "../../src/lib/content-constants.ts";
import type {
  Building,
  Faction,
  FeatItem,
  GalleryItemData,
  MapItem,
  Misc,
  Section,
  Tag,
  Text,
  Unit,
  VideoItem,
} from "../../src/lib/schemas.ts";
import type { Lang } from "../../src/lib/site.ts";

export type {
  CollectionName,
  Faction,
  FeatItem,
  GalleryItemData,
  Lang,
  MapItem,
  Section,
  Tag,
  Text,
  VideoItem,
};
export type LocalizedText = Text;
export type Card = Unit | Building | Misc;
export type CollectionItem =
  | Card
  | Faction
  | Tag
  | Section
  | MapItem
  | GalleryItemData
  | VideoItem
  | FeatItem;

/** Section из bootstrap дополняется вычисляемым nextOrder. */
export type SectionView = Section & { nextOrder?: number };

export function isCard(item: CollectionItem): item is Card {
  return "faction" in item && "tags" in item && "cost" in item;
}

export function isFaction(item: CollectionItem): item is Faction {
  return "color" in item && "emblem" in item && "lore" in item;
}

export function isTag(item: CollectionItem): item is Tag {
  return "group" in item;
}

export function isSection(item: CollectionItem): item is Section {
  return "icon" in item && "title" in item;
}

export interface ArticleFile {
  title: string;
  desc: string;
  body: string;
  file: string;
  exists: boolean;
  extra?: Record<string, unknown>;
}

export interface Article {
  slug: string;
  section: string;
  order: number;
  updated: string;
  draft: boolean;
  new: boolean;
  newUntil?: string | undefined;
  orderMismatch: boolean;
  draftMismatch: boolean;
  ru: ArticleFile;
  en: ArticleFile;
}

export interface ArticleSummary {
  slug: string;
  section: string;
  title: LocalizedText;
  desc: LocalizedText;
  order: number;
  updated: string;
  draft: boolean;
  new: boolean;
  newUntil?: string | undefined;
  hasRu: boolean;
  hasEn: boolean;
  orderMismatch: boolean;
  draftMismatch: boolean;
  mtime: number;
  error?: string | undefined;
}

export interface ValidationState {
  ok: boolean;
  errors: string[];
  checkedAt: string;
}

export interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  dirty: boolean;
  files: GitFile[];
  ahead: number;
  behind: number;
  upstream: string | null;
  lastCommit: string;
}

export interface Bootstrap {
  sections: SectionView[];
  factions: Faction[];
  tags: Tag[];
  counts: {
    articles: number;
    drafts: number;
    units: number;
    buildings: number;
    misc: number;
    factions: number;
    tags: number;
    sections: number;
    maps: number;
    gallery: number;
    videos: number;
    feats: number;
  };
  validation: ValidationState;
  git: GitStatus;
  site: { running: boolean; url: string };
  recentArticles: ArticleSummary[];
  warnings: string[];
}

export interface ArticleSaveInput {
  originalSlug?: string;
  section: string;
  slug: string;
  order: number;
  updated: string;
  draft: boolean;
  new: boolean;
  newUntil?: string | undefined;
  ru: Omit<ArticleFile, "file" | "exists">;
  en: Omit<ArticleFile, "file" | "exists">;
}

export interface CollectionSaveInput {
  item: CollectionItem;
  originalId?: string;
}

export interface UploadResult {
  path: string;
  url: string;
  markdown?: string;
  width?: number;
  height?: number;
  size: number;
}

export interface PreviewResult {
  html: string;
  css: string;
}

export interface ToastItem {
  id: number;
  message: string;
  type: "ok" | "error" | "warn";
}

export type ToastFn = (message: string, type?: ToastItem["type"]) => void;

export type AskConfirm = (options: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) => Promise<boolean>;
