import { createServer } from "node:http";
import path from "node:path";

import { createServer as createViteServer } from "vite";

import type {
  ArticleSaveInput,
  Bootstrap,
  CollectionName,
  CollectionSaveInput,
  GitStatus,
  Lang,
} from "../shared/types.ts";
import {
  articleDefaults,
  deleteArticle,
  duplicateArticle,
  listArticles,
  readArticle,
  saveArticle,
} from "./articles.ts";
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollection,
  saveCollectionItem,
} from "./collections.ts";
import { ADMIN_ROOT, HOST, PORT, SITE_DEV_URL } from "./config.ts";
import { readItems, readSections, readFactions, readTags } from "./data.ts";
import {
  HttpError,
  readJsonBody,
  sendJson,
  serveMedia,
} from "./http.ts";
import { saveUpload, type UploadKind } from "./images.ts";
import { renderPreview } from "./preview.ts";
import { gitCommit, gitDiff, gitPush, gitStatus } from "./git.ts";
import { runValidation } from "./validation.ts";

const COLLECTIONS = new Set<CollectionName>(["units", "buildings", "factions", "tags", "sections"]);

function isCollectionName(value: string | undefined): value is CollectionName {
  return value !== undefined && COLLECTIONS.has(value as CollectionName);
}

async function siteRunning(): Promise<boolean> {
  try {
    const response = await fetch(SITE_DEV_URL, {
      signal: AbortSignal.timeout(900),
      redirect: "manual",
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function safeGitStatus(): Promise<GitStatus> {
  try {
    return await gitStatus();
  } catch (error) {
    return {
      branch: "—",
      dirty: false,
      files: [],
      ahead: 0,
      behind: 0,
      upstream: null,
      lastCommit: error instanceof Error ? error.message : String(error),
    };
  }
}

async function bootstrap(): Promise<Bootstrap> {
  const [sections, factions, tags, articles, units, buildings, validation, git, running] =
    await Promise.all([
      readSections(),
      readFactions(),
      readTags(),
      listArticles(),
      readItems<{ id: string }>("units"),
      readItems<{ id: string }>("buildings"),
      Promise.resolve(runValidation()),
      safeGitStatus(),
      siteRunning(),
    ]);

  const enrichedSections = sections.map((section) => {
    const inSection = articles.filter((article) => article.section === section.id);
    return {
      ...section,
      articleCount: inSection.length,
      nextOrder: inSection.reduce((max, article) => Math.max(max, article.order), 0) + 1,
    };
  });

  const warnings: string[] = [];
  if (!validation.ok) {
    warnings.push(`Валидация: ${validation.errors.length} ошибок.`);
  }

  return {
    sections: enrichedSections,
    factions,
    tags,
    counts: {
      articles: articles.length,
      drafts: articles.filter((article) => article.draft).length,
      units: units.length,
      buildings: buildings.length,
      factions: factions.length,
      tags: tags.length,
      sections: sections.length,
    },
    validation,
    git,
    site: { running, url: SITE_DEV_URL },
    recentArticles: [...articles].sort((a, b) => b.mtime - a.mtime).slice(0, 8),
    warnings,
  };
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Поле ${name} обязательно`);
  }
  return value;
}

async function handleApi(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/api/")) return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.origin;
    const allowed = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
    if (origin && !allowed.has(origin)) {
      throw new HttpError(403, "Запрос с чужого origin запрещён");
    }
  }

  const route = url.pathname.slice("/api".length);

  if (route === "/bootstrap" && req.method === "GET") {
    sendJson(res, 200, await bootstrap());
    return true;
  }

  if (route === "/validate" && (req.method === "GET" || req.method === "POST")) {
    sendJson(res, 200, runValidation());
    return true;
  }

  if (route === "/articles" && req.method === "GET") {
    sendJson(res, 200, { items: await listArticles() });
    return true;
  }

  if (route === "/articles/defaults" && req.method === "GET") {
    const section = url.searchParams.get("section") ?? "";
    sendJson(res, 200, await articleDefaults(section));
    return true;
  }

  if (route === "/article" && req.method === "GET") {
    const slug = url.searchParams.get("slug");
    if (!slug) throw new HttpError(400, "Нет параметра slug");
    sendJson(res, 200, await readArticle(slug));
    return true;
  }

  if (route === "/article" && req.method === "POST") {
    const input = (await readJsonBody(req)) as ArticleSaveInput;
    sendJson(res, 200, await saveArticle(input));
    return true;
  }

  if (route === "/article" && req.method === "DELETE") {
    const slug = url.searchParams.get("slug");
    if (!slug) throw new HttpError(400, "Нет параметра slug");
    sendJson(res, 200, { validation: await deleteArticle(slug) });
    return true;
  }

  if (route === "/article/duplicate" && req.method === "POST") {
    const body = (await readJsonBody(req)) as { slug?: unknown };
    const slug = requireString(body.slug, "slug");
    sendJson(res, 200, await duplicateArticle(slug));
    return true;
  }

  if (route === "/preview" && req.method === "POST") {
    const body = (await readJsonBody(req)) as {
      lang?: Lang;
      section?: unknown;
      slug?: unknown;
      body?: unknown;
    };
    const lang = body.lang === "en" ? "en" : "ru";
    const section = typeof body.section === "string" ? body.section : "misc";
    const slug = typeof body.slug === "string" ? body.slug : `${section}/preview`;
    const text = typeof body.body === "string" ? body.body : "";
    sendJson(res, 200, await renderPreview({ lang, section, slug, body: text }));
    return true;
  }

  if (route === "/upload" && req.method === "POST") {
    const body = (await readJsonBody(req)) as {
      kind?: UploadKind;
      filename?: unknown;
      dataUrl?: unknown;
      slug?: unknown;
      id?: unknown;
      alt?: unknown;
    };
    if (body.kind !== "article" && body.kind !== "card" && body.kind !== "faction") {
      throw new HttpError(400, "Неизвестный тип загрузки");
    }
    const result = await saveUpload({
      kind: body.kind,
      filename: typeof body.filename === "string" ? body.filename : "image",
      dataUrl: requireString(body.dataUrl, "dataUrl"),
      slug: typeof body.slug === "string" ? body.slug : undefined,
      id: typeof body.id === "string" ? body.id : undefined,
      alt: typeof body.alt === "string" ? body.alt : undefined,
    });
    sendJson(res, 200, result);
    return true;
  }

  const collectionMatch = /^\/collections\/([^/]+)(?:\/([^/]+))?$/.exec(route);
  if (collectionMatch) {
    const name = collectionMatch[1];
    if (!isCollectionName(name)) throw new HttpError(404, "Неизвестная коллекция");
    const id = collectionMatch[2] ? decodeURIComponent(collectionMatch[2]) : undefined;

    if (req.method === "GET" && id) {
      sendJson(res, 200, { item: await getCollectionItem(name, id) });
      return true;
    }
    if (req.method === "GET") {
      sendJson(res, 200, { items: await listCollection(name) });
      return true;
    }
    if (req.method === "POST") {
      const body = (await readJsonBody(req)) as CollectionSaveInput;
      if (!body || typeof body !== "object" || !("item" in body)) {
        throw new HttpError(400, "Нет данных записи");
      }
      sendJson(res, 200, await saveCollectionItem(name, body.item, body.originalId));
      return true;
    }
    if (req.method === "DELETE") {
      if (!id) throw new HttpError(400, "Нет id записи");
      sendJson(res, 200, { validation: await deleteCollectionItem(name, id) });
      return true;
    }
  }

  if (route === "/git/status" && req.method === "GET") {
    sendJson(res, 200, await gitStatus());
    return true;
  }
  if (route === "/git/diff" && req.method === "GET") {
    const files = url.searchParams.getAll("file");
    sendJson(res, 200, { diff: await gitDiff(files) });
    return true;
  }
  if (route === "/git/commit" && req.method === "POST") {
    const body = (await readJsonBody(req)) as { files?: unknown; message?: unknown };
    const files = Array.isArray(body.files)
      ? body.files.filter((file): file is string => typeof file === "string")
      : [];
    const message = requireString(body.message, "message");
    sendJson(res, 200, await gitCommit(files, message));
    return true;
  }
  if (route === "/git/push" && req.method === "POST") {
    sendJson(res, 200, await gitPush());
    return true;
  }

  throw new HttpError(404, `Неизвестный API-маршрут: ${route}`);
}

const httpServer = createServer();
const vite = await createViteServer({
  root: ADMIN_ROOT,
  configFile: path.join(ADMIN_ROOT, "vite.config.ts"),
  server: {
    middlewareMode: true,
    ws: { server: httpServer },
  },
  appType: "spa",
});

httpServer.on("request", async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (await serveMedia(req, res, url.pathname)) return;
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    vite.middlewares(req, res, (error) => {
      if (error) {
        console.error("[admin] vite:", error);
        if (!res.headersSent) sendJson(res, 500, { error: "Ошибка Vite" });
      }
    });
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message, details: error.details });
    } else {
      console.error("[admin]", error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Внутренняя ошибка админки",
        });
      }
    }
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log("");
  console.log("  WWN Admin");
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  сайт: ${SITE_DEV_URL} (запускается отдельно: pnpm dev)`);
  console.log("");
});

function shutdown(): void {
  httpServer.close(() => process.exit(0));
  void vite.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
