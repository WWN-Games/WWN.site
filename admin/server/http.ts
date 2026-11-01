import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { SITE_ROOT } from "./config.ts";

export class HttpError extends Error {
  status: number;
  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function isInside(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

export async function readText(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

export async function readJson<T>(file: string): Promise<T> {
  const text = await readText(file);
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new HttpError(
      500,
      `Не удалось прочитать JSON: ${toPosix(path.relative(process.cwd(), file))}`,
      [error instanceof Error ? error.message : String(error)],
    );
  }
}

export async function atomicWrite(file: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

export async function readJsonBody(req: IncomingMessage, limit = 25 * 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new HttpError(413, "Слишком большой запрос");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "Некорректный JSON в запросе");
  }
}

const MIME: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ts": "text/javascript; charset=utf-8",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const ALLOWED_MEDIA_ROOTS = [
  { prefix: "/media/public/", root: "public" },
  { prefix: "/media/assets/", root: "src/assets" },
] as const;

export async function serveMedia(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const entry = ALLOWED_MEDIA_ROOTS.find((item) => pathname.startsWith(item.prefix));
  if (!entry) return false;

  const root = path.join(SITE_ROOT, entry.root);
  const relative = decodeURIComponent(pathname.slice(entry.prefix.length));
  const target = path.resolve(root, relative);
  if (!isInside(root, target)) {
    sendJson(res, 403, { error: "Запрещённый путь" });
    return true;
  }

  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: "Файл не найден" });
      return true;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "no-store");
    createReadStream(target).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Файл не найден" });
  }
  return true;
}
