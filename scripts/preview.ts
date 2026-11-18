/* ============================================================================
   WWN — минимальный foreground-сервер для e2e-тестов.
   Astro preview в неинтерактивном режиме уходит в фон, поэтому Playwright
   запускает этот скрипт: отдаёт dist/ с base /WWN.site и 404.html.
   ============================================================================ */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { MIME_TYPES } from "../src/lib/mime.ts";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const BASE = "/WWN.site";
const PORT = Number(process.env.PORT ?? 4321);

async function fileFor(pathname: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const target = path.join(DIST, decoded);
  const relative = path.relative(DIST, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  try {
    const info = await stat(target);
    if (info.isDirectory()) return path.join(target, "index.html");
    return target;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (!url.pathname.startsWith(BASE)) {
    response.writeHead(302, { Location: `${BASE}/` });
    response.end();
    return;
  }
  const relative = url.pathname.slice(BASE.length) || "/";
  const file = await fileFor(relative);
  if (!file) {
    const fallback = path.join(DIST, "404.html");
    response.writeHead(404, { "Content-Type": MIME_TYPES[".html"] });
    createReadStream(fallback).pipe(response);
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`preview: http://localhost:${PORT}${BASE}/`);
});
