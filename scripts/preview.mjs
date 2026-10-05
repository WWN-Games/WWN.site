/* ============================================================================
   WWN — минимальный foreground-сервер для e2e-тестов.
   Astro preview в неинтерактивном режиме уходит в фон, поэтому Playwright
   запускает этот скрипт: отдаёт dist/ с base /WWN.site и 404.html.
   ============================================================================ */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const DIST = resolve("dist");
const BASE = "/WWN.site";
const PORT = Number(process.env.PORT ?? 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
};

async function fileFor(pathname) {
  const decoded = decodeURIComponent(pathname);
  const target = join(DIST, decoded);
  if (!target.startsWith(DIST)) return null;
  try {
    const info = await stat(target);
    if (info.isDirectory()) return join(target, "index.html");
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
    const fallback = join(DIST, "404.html");
    response.writeHead(404, { "Content-Type": MIME[".html"] });
    createReadStream(fallback).pipe(response);
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`preview: http://localhost:${PORT}${BASE}/`);
});
