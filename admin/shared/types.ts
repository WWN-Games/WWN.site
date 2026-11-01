/* Общие типы клиента и сервера локальной админки. */

export type Lang = "ru" | "en";

export interface LocalizedText {
  ru: string;
  en: string;
}

export type CollectionName = "units" | "buildings" | "factions" | "tags" | "sections";

export interface Section {
  id: string;
  icon: string;
  order: number;
  title: LocalizedText;
  desc: LocalizedText;
  articleCount?: number;
  nextOrder?: number;
}

export interface Tag {
  id: string;
  name: LocalizedText;
  group: "tier" | "class" | "movement" | "mod";
}

export interface Faction {
  id: string;
  order: number;
  name: LocalizedText;
  color: string;
  emblem: string;
  lore: string;
  desc: LocalizedText;
  motto?: LocalizedText;
  playstyle?: LocalizedText;
  specialty?: LocalizedText;
  strengths?: { ru: string[]; en: string[] };
  weaknesses?: { ru: string[]; en: string[] };
  subfaction?: boolean | string;
}

export interface Card {
  id: string;
  name: LocalizedText;
  faction: string;
  type: string;
  desc: LocalizedText;
  tags: string[];
  cost: number;
  hp: number;
  buildTime: number;
  shield?: number;
  dps?: number;
  speed?: number;
  range?: number;
  image?: string;
  role?: LocalizedText;
  strongVs?: string[] | LocalizedText;
  weakVs?: string[] | LocalizedText;
  draft?: boolean;
  new?: boolean;
}

export type CollectionItem = Card | Faction | Tag | Section;

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
  hasRu: boolean;
  hasEn: boolean;
  orderMismatch: boolean;
  draftMismatch: boolean;
  mtime: number;
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
  sections: Section[];
  factions: Faction[];
  tags: Tag[];
  counts: {
    articles: number;
    drafts: number;
    units: number;
    buildings: number;
    factions: number;
    tags: number;
    sections: number;
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
  ru: Omit<ArticleFile, "file">;
  en: Omit<ArticleFile, "file">;
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
  sitePath: string;
}

export interface ApiError {
  error: string;
  details?: string[];
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
