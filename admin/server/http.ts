import { randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import { SITE_ROOT } from "./config.ts";

export class HttpError extends Error {
  status: number;
  details?: string[] | undefined;

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
}

export function isInside(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
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
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, contents, "utf8");
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
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

export async function readJsonBody(
  req: IncomingMessage,
  limit = 32 * 1024 * 1024,
): Promise<unknown> {
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "Ожидается Content-Type: application/json");
  }
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

export async function serveMedia(
  _req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const entry = ALLOWED_MEDIA_ROOTS.find((item) => pathname.startsWith(item.prefix));
  if (!entry) return false;

  const root = path.join(SITE_ROOT, entry.root);
  let relative: string;
  try {
    relative = decodeURIComponent(pathname.slice(entry.prefix.length));
  } catch {
    sendJson(res, 400, { error: "Некорректный путь" });
    return true;
  }
  const target = path.resolve(root, relative);
  if (!isInside(root, target)) {
    sendJson(res, 403, { error: "Запрещённый путь" });
    return true;
  }

  try {
    // realpath проверяет, что симлинк внутри media-корня не выводит наружу.
    const [realRoot, realTarget] = await Promise.all([fs.realpath(root), fs.realpath(target)]);
    if (!isInside(realRoot, realTarget)) {
      sendJson(res, 403, { error: "Запрещённый путь" });
      return true;
    }
    const stat = await fs.stat(realTarget);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: "Файл не найден" });
      return true;
    }
    const extension = path.extname(realTarget).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extension] ?? "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "no-store");
    if (extension === ".svg") {
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    }
    const stream = createReadStream(realTarget);
    stream.on("error", () => {
      if (!res.headersSent) sendJson(res, 500, { error: "Не удалось прочитать файл" });
      else res.destroy();
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch {
    sendJson(res, 404, { error: "Файл не найден" });
  }
  return true;
}
