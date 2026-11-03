import { formatNumber, formatDate as formatSiteDate } from "../../../src/lib/utils";

export { slugify } from "../../shared/slug";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  return formatSiteDate(value, "ru");
}

export function formatCount(value: number): string {
  return formatNumber(value, "ru");
}

export function assetUrl(path: string | undefined): string {
  if (!path) return "";
  if (path.startsWith("/media/") || path.startsWith("http")) return path;
  const clean = path.replace(/^\/+/, "").replace(/^src\//, "");
  if (clean.startsWith("assets/")) return `/media/assets/${clean.slice("assets/".length)}`;
  if (clean.startsWith("img/")) return `/media/public/${clean}`;
  return `/media/public/${clean}`;
}

export function cardImageUrl(item: { id: string; image?: string }): string {
  if (item.image === "") return "";
  if (item.image) return assetUrl(item.image);
  return `/media/public/img/database/${item.id}.avif`;
}

export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
