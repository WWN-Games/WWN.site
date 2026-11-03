import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { isSlug, slugify } from "../shared/slug.ts";
import type { UploadResult } from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { atomicWrite, fileExists, HttpError, isInside } from "./http.ts";

const PUBLIC_ROOT = path.join(SITE_ROOT, "public");
const ASSETS_ROOT = path.join(SITE_ROOT, "src/assets");
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_RASTER_MIME = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type UploadKind = "article" | "card" | "faction";

interface UploadInput {
  kind: UploadKind;
  filename: string;
  dataUrl: string;
  slug?: string | undefined;
  id?: string | undefined;
  alt?: string | undefined;
}

function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) throw new HttpError(400, "Ожидается data URL с base64");
  const mime = (match[1] ?? "").toLowerCase();
  const base64 = match[2] ?? "";
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new HttpError(400, "Пустой файл");
  if (buffer.length > MAX_BYTES) throw new HttpError(413, "Файл больше 20 МБ");
  return { mime, buffer };
}

async function uniqueArticleName(articleName: string, base: string): Promise<string> {
  const dir = path.join(ASSETS_ROOT, "img/lore");
  let candidate = `${articleName}-${base}`;
  let counter = 2;
  while (await fileExists(path.join(dir, `${candidate}.avif`))) {
    candidate = `${articleName}-${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function assertSafeSvg(text: string): void {
  const dangerous = [
    /<script[\s>]/i,
    /<foreignObject[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /\son[a-z]+\s*=/i,
    /javascript:/i,
    /<!ENTITY/i,
    /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:)?\/\//i,
  ];
  if (dangerous.some((pattern) => pattern.test(text))) {
    throw new HttpError(400, "SVG содержит недопустимые элементы или ссылки");
  }
}

async function saveRaster(
  buffer: Buffer,
  target: string,
  width: number,
): Promise<{ width: number; height: number; size: number }> {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await sharp(buffer, { failOn: "none", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 80, effort: 4 })
      .toFile(tmp);
    await fs.rename(tmp, target);
    const [meta, stat] = await Promise.all([sharp(target).metadata(), fs.stat(target)]);
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      size: stat.size,
    };
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw new HttpError(400, "Не удалось обработать изображение", [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}

export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  if (!input || typeof input !== "object") throw new HttpError(400, "Нет данных файла");
  const { mime, buffer } = decodeDataUrl(input.dataUrl);
  if (input.kind !== "faction" && !ALLOWED_RASTER_MIME.has(mime)) {
    throw new HttpError(400, `Недопустимый формат изображения: ${mime}`);
  }
  const original = path.basename(input.filename || "image");
  const base = slugify(original.replace(/\.[^.]+$/, "")) || "image";

  if (input.kind === "article") {
    const parts = (input.slug ?? "").split("/");
    const articleName = parts[parts.length - 1] ?? "";
    if (!isSlug(articleName)) throw new HttpError(400, "Сначала задайте корректный slug статьи");
    const name = await uniqueArticleName(articleName, base);
    const target = path.join(ASSETS_ROOT, "img/lore", `${name}.avif`);
    if (!isInside(path.join(ASSETS_ROOT, "img/lore"), target)) {
      throw new HttpError(400, "Некорректный путь изображения");
    }
    const meta = await saveRaster(buffer, target, 1920);
    const relative = `assets/img/lore/${name}.avif`;
    const alt = (input.alt ?? "").replace(/[\r\n]+/g, " ").trim() || "Иллюстрация";
    return {
      path: relative,
      url: `/media/assets/img/lore/${name}.avif`,
      markdown: `![${alt}](../../../../${relative})`,
      ...meta,
    };
  }

  if (input.kind === "card") {
    const id = (input.id ?? "").trim();
    if (!isSlug(id)) throw new HttpError(400, "Сначала задайте корректный id карточки");
    const target = path.join(PUBLIC_ROOT, "img/database", `${id}.avif`);
    if (!isInside(path.join(PUBLIC_ROOT, "img/database"), target)) {
      throw new HttpError(400, "Некорректный путь изображения");
    }
    const meta = await saveRaster(buffer, target, 256);
    return {
      path: `img/database/${id}.avif`,
      url: `/media/public/img/database/${id}.avif`,
      ...meta,
    };
  }

  if (input.kind === "faction") {
    const id = (input.id ?? "").trim();
    if (!isSlug(id)) throw new HttpError(400, "Сначала задайте корректный id фракции");
    if (mime !== "image/svg+xml" && !original.toLowerCase().endsWith(".svg")) {
      throw new HttpError(400, "Эмблема фракции должна быть SVG");
    }
    if (buffer.length > 2 * 1024 * 1024) throw new HttpError(413, "SVG больше 2 МБ");
    const text = buffer.toString("utf8");
    if (!/<svg[\s>]/i.test(text)) throw new HttpError(400, "В файле нет SVG-разметки");
    assertSafeSvg(text);
    const target = path.join(ASSETS_ROOT, "img/factions", `${id}.svg`);
    if (!isInside(path.join(ASSETS_ROOT, "img/factions"), target)) {
      throw new HttpError(400, "Некорректный путь эмблемы");
    }
    await atomicWrite(target, `${text.trimEnd()}\n`);
    return {
      path: `assets/img/factions/${id}.svg`,
      url: `/media/assets/img/factions/${id}.svg`,
      size: buffer.length,
    };
  }

  throw new HttpError(400, "Неизвестный тип загрузки");
}
