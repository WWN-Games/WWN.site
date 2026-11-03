import { createServer } from "node:http";
import path from "node:path";

import { createServer as createViteServer } from "vite";
import { COLLECTION_NAMES } from "../../src/lib/collections.ts";
import type {
  ArticleSaveInput,
  Bootstrap,
  CollectionName,
  CollectionSaveInput,
  GitStatus,
  Lang,
} from "../shared/types.ts";
import {
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
import {
  ADMIN_ORIGIN,
  ADMIN_ROOT,
  EXTRA_ORIGINS,
  HOST,
  IS_LOOPBACK_HOST,
  PORT,
  SITE_DEV_URL,
} from "./config.ts";
import { readFactions, readItems, readSections, readTags } from "./data.ts";
import { gitCommit, gitDiff, gitPush, gitStatus } from "./git.ts";
import { applySecurityHeaders, HttpError, readJsonBody, sendJson, serveMedia } from "./http.ts";
import { saveUpload, type UploadKind } from "./images.ts";
import { renderPreview } from "./preview.ts";
import { runValidation } from "./validation.ts";

const COLLECTIONS = new Set<string>(COLLECTION_NAMES);

function isCollectionName(value: string | undefined): value is CollectionName {
  return value !== undefined && COLLECTIONS.has(value);
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

interface ApiContext {
  req: import("node:http").IncomingMessage;
  res: import("node:http").ServerResponse;
  url: URL;
  params: Record<string, string | undefined>;
}

interface ApiRoute {
  method: "GET" | "POST" | "DELETE";
  pattern: URLPattern;
  handle: (context: ApiContext) => Promise<void>;
}

function collectionName(value: string | undefined): CollectionName {
  if (!isCollectionName(value)) throw new HttpError(404, "Неизвестная коллекция");
  return value;
}

const apiRoutes: ApiRoute[] = [
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/bootstrap" }),
    handle: async ({ res }) => sendJson(res, 200, await bootstrap()),
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/validate" }),
    handle: async ({ res }) => sendJson(res, 200, runValidation()),
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/articles" }),
    handle: async ({ res }) => sendJson(res, 200, { items: await listArticles() }),
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/article" }),
    handle: async ({ res, url }) => {
      const slug = url.searchParams.get("slug");
      if (!slug) throw new HttpError(400, "Нет параметра slug");
      sendJson(res, 200, await readArticle(slug));
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/article" }),
    handle: async ({ req, res }) => {
      const input = (await readJsonBody(req)) as ArticleSaveInput;
      sendJson(res, 200, await saveArticle(input));
    },
  },
  {
    method: "DELETE",
    pattern: new URLPattern({ pathname: "/api/article" }),
    handle: async ({ res, url }) => {
      const slug = url.searchParams.get("slug");
      if (!slug) throw new HttpError(400, "Нет параметра slug");
      sendJson(res, 200, { validation: await deleteArticle(slug) });
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/article/duplicate" }),
    handle: async ({ req, res }) => {
      const body = (await readJsonBody(req)) as { slug?: unknown };
      sendJson(res, 200, await duplicateArticle(requireString(body.slug, "slug")));
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/preview" }),
    handle: async ({ req, res }) => {
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
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/upload" }),
    handle: async ({ req, res }) => {
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
      sendJson(
        res,
        200,
        await saveUpload({
          kind: body.kind,
          filename: typeof body.filename === "string" ? body.filename : "image",
          dataUrl: requireString(body.dataUrl, "dataUrl"),
          slug: typeof body.slug === "string" ? body.slug : undefined,
          id: typeof body.id === "string" ? body.id : undefined,
          alt: typeof body.alt === "string" ? body.alt : undefined,
        }),
      );
    },
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/collections/:name/:id" }),
    handle: async ({ res, params }) => {
      const id = decodeURIComponent(params.id ?? "");
      if (!id) throw new HttpError(400, "Нет id записи");
      sendJson(res, 200, { item: await getCollectionItem(collectionName(params.name), id) });
    },
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/collections/:name" }),
    handle: async ({ res, params }) => {
      sendJson(res, 200, { items: await listCollection(collectionName(params.name)) });
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/collections/:name" }),
    handle: async ({ req, res, params }) => {
      const body = (await readJsonBody(req)) as CollectionSaveInput;
      if (!body || typeof body !== "object" || !("item" in body)) {
        throw new HttpError(400, "Нет данных записи");
      }
      sendJson(
        res,
        200,
        await saveCollectionItem(collectionName(params.name), body.item, body.originalId),
      );
    },
  },
  {
    method: "DELETE",
    pattern: new URLPattern({ pathname: "/api/collections/:name/:id" }),
    handle: async ({ res, params }) => {
      const id = decodeURIComponent(params.id ?? "");
      if (!id) throw new HttpError(400, "Нет id записи");
      sendJson(res, 200, {
        validation: await deleteCollectionItem(collectionName(params.name), id),
      });
    },
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/git/status" }),
    handle: async ({ res }) => sendJson(res, 200, await gitStatus()),
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/git/diff" }),
    handle: async ({ res, url }) =>
      sendJson(res, 200, { diff: await gitDiff(url.searchParams.getAll("file")) }),
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/git/commit" }),
    handle: async ({ req, res }) => {
      const body = (await readJsonBody(req)) as { files?: unknown; message?: unknown };
      const files = Array.isArray(body.files)
        ? body.files.filter((file): file is string => typeof file === "string")
        : [];
      sendJson(res, 200, await gitCommit(files, requireString(body.message, "message")));
    },
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/git/push" }),
    handle: async ({ res }) => sendJson(res, 200, await gitPush()),
  },
];

async function handleApi(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/")) return false;

  if (req.method !== "GET") {
    const origin = req.headers.origin;
    const allowed = new Set([
      `http://127.0.0.1:${PORT}`,
      `http://localhost:${PORT}`,
      ADMIN_ORIGIN,
      ...EXTRA_ORIGINS,
    ]);
    const site = req.headers["sec-fetch-site"];
    if (typeof site === "string" && site !== "same-origin" && site !== "none") {
      throw new HttpError(403, "Запрос с чужого сайта запрещён");
    }
    // Браузер всегда шлёт Origin для same-origin POST/DELETE. Запрос без него —
    // это curl или CSRF-попытка; для локальной админки такие запросы не нужны.
    if (!origin || !allowed.has(origin)) {
      throw new HttpError(403, "Запрос с чужого origin запрещён");
    }
  }

  for (const route of apiRoutes) {
    if (req.method !== route.method) continue;
    const match = route.pattern.exec(url);
    if (!match) continue;
    await route.handle({ req, res, url, params: match.pathname.groups });
    return true;
  }

  throw new HttpError(404, `Неизвестный API-маршрут: ${url.pathname}`);
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
  applySecurityHeaders(res);
  if (IS_LOOPBACK_HOST) {
    const hostname = String(req.headers.host ?? "")
      .replace(/:\d+$/, "")
      .toLowerCase();
    if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
      sendJson(res, 403, { error: "Неверный Host" });
      return;
    }
  }
  const url = new URL(req.url ?? "/", ADMIN_ORIGIN);
  try {
    if (await serveMedia(req, res, url.pathname)) return;
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    vite.middlewares(req, res, (error: unknown) => {
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
        sendJson(res, 500, { error: "Внутренняя ошибка админки" });
      }
    }
  }
});

httpServer.on("error", (error) => {
  console.error(`[admin] не удалось запустить сервер на ${HOST}:${PORT}:`, error.message);
  process.exit(1);
});

httpServer.listen(PORT, HOST, () => {
  console.log("");
  console.log("  WWN Admin");
  console.log(`  ${ADMIN_ORIGIN}`);
  console.log(`  сайт: ${SITE_DEV_URL} (запускается отдельно: pnpm dev)`);
  if (!IS_LOOPBACK_HOST && EXTRA_ORIGINS.length === 0) {
    console.warn(
      "  ВНИМАНИЕ: сервер слушает не loopback без ADMIN_ORIGIN — запросы с других origin будут отклонены.",
    );
  }
  console.log("");
});

function shutdown(): void {
  httpServer.close(() => process.exit(0));
  void vite.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
