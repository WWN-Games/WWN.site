/* ============================================================================
   WWN — клиентский поиск на Pagefind.
   Браузерный API отдаёт результаты в два шага: сначала ссылки, затем данные
   (url, excerpt, meta, filters) по каждой. Здесь — загрузка бандла из
   public/pagefind, нормализация URL с учётом base и чистые помощники острова.
   ============================================================================ */

import type { Lang } from "./site";
import { escapeHtml, foldSearch } from "./utils";

/** База сайта с хвостовым слэшем: "/WWN.site/". */
export const BASE_URL: string = import.meta.env.BASE_URL;

/** Данные одного результата, которые использует интерфейс. */
export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
}

/** Ссылка на результат до загрузки данных. */
export interface PagefindResultRef {
  id: string;
  score: number;
  data: () => Promise<PagefindResultData>;
}

/** Ответ pagefind.search(). */
export interface PagefindSearchResponse {
  results: PagefindResultRef[];
  unfilteredResultCount?: number;
  filters?: Record<string, Record<string, number>>;
  totalFilters?: Record<string, Record<string, number>>;
}

/** Минимум браузерного API Pagefind, который вызывает интерфейс. */
export interface PagefindModule {
  options?: (options: { baseUrl?: string }) => Promise<void>;
  search: (
    query: string,
    options?: { filters?: Record<string, string> },
  ) => Promise<PagefindSearchResponse>;
  destroy?: () => Promise<void>;
}

let modulePromise: Promise<PagefindModule> | null = null;
let resetPromise: Promise<void> | null = null;
let loadedLang: Lang | null = null;

/** Импорт браузерного бандла Pagefind: /<base>/pagefind/pagefind.js. */
async function importPagefind(): Promise<PagefindModule> {
  const url = `${BASE_URL}pagefind/pagefind.js`;
  const pagefind = (await import(/* @vite-ignore */ url)) as PagefindModule;
  return pagefind;
}

/** Загружает Pagefind и настраивает baseUrl.
 *  Воркер запоминает язык в момент инициализации, а View Transitions меняют
 *  <html lang> без перезагрузки — поэтому при смене языка сбрасываем его. */
export async function loadPagefind(lang: Lang): Promise<PagefindModule> {
  modulePromise ??= importPagefind();
  let pagefind: PagefindModule;
  try {
    pagefind = await modulePromise;
  } catch (error) {
    modulePromise = null; // следующий ввод попробует снова
    throw error;
  }
  if (resetPromise) await resetPromise;

  if (loadedLang !== lang) {
    if (loadedLang !== null && typeof pagefind.destroy === "function") {
      try {
        await pagefind.destroy();
      } catch {
        // воркер мог уже завершиться — настройки всё равно применим заново
      }
    }
    loadedLang = lang;
    if (typeof pagefind.options === "function") {
      try {
        await pagefind.options({ baseUrl: BASE_URL });
      } catch {
        // baseUrl и так выведен из пути импорта — поиск всё равно сработает
      }
    }
  }

  return pagefind;
}

/** Сбрасывает инициализированный воркер: следующий поиск поднимет его заново.
 *  Promise кэшируется, чтобы новый поиск не стартовал посреди destroy(). */
export function resetPagefind(): Promise<void> {
  loadedLang = null;
  if (!modulePromise) return Promise.resolve();
  resetPromise ??= (async () => {
    try {
      const pagefind = await modulePromise;
      if (typeof pagefind.destroy === "function") await pagefind.destroy();
    } catch {
      // модуль не загрузился — сбрасывать нечего
    } finally {
      resetPromise = null;
    }
  })();
  return resetPromise;
}

/** URL без base: "/WWN.site/wiki/x/" → "/wiki/x/". */
export function stripBase(url: string, base: string = BASE_URL): string {
  const prefix = base.replace(/\/+$/, "");
  if (!prefix) return url;
  if (url === prefix) return "/";
  return url.startsWith(`${prefix}/`) ? url.slice(prefix.length) : url;
}

/** URL с base, идемпотентно: "/wiki/x/" → "/WWN.site/wiki/x/". */
export function withBase(url: string, base: string = BASE_URL): string {
  if (!url) return base;
  if (/^(https?:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${base}${stripBase(url, base).replace(/^\/+/, "")}`;
}

/** EN-страницы живут под /en/, остальные — RU (язык по умолчанию без префикса). */
export function isLangUrl(url: string, lang: Lang): boolean {
  const path = stripBase(url);
  const isEn = path === "/en" || path.startsWith("/en/");
  return lang === "en" ? isEn : !isEn;
}

/** id раздела из фильтров результата (data-pagefind-filter="section"). */
export function sectionOf(data: PagefindResultData): string {
  return data.filters?.section?.[0] ?? "";
}

/** Счётчики разделов для запроса без учёта выбранного фильтра. */
export function sectionCounts(response: PagefindSearchResponse): Record<string, number> {
  const counts = response.totalFilters?.section ?? {};
  const result: Record<string, number> = {};
  for (const [id, count] of Object.entries(counts)) {
    if (typeof count === "number") result[id] = count;
  }
  return result;
}

/** Подсветка совпадений в заголовке: свёртка 1:1, поэтому позиции совпадают. */
export function highlight(text: string, query: string): string {
  const needle = foldSearch(query.trim());
  if (!needle) return escapeHtml(text);
  const fold = foldSearch(text);
  const parts: string[] = [];
  let pos = 0;
  let index = fold.indexOf(needle);
  while (index !== -1) {
    parts.push(
      escapeHtml(text.slice(pos, index)),
      "<mark>",
      escapeHtml(text.slice(index, index + needle.length)),
      "</mark>",
    );
    pos = index + needle.length;
    index = fold.indexOf(needle, pos);
  }
  parts.push(escapeHtml(text.slice(pos)));
  return parts.join("");
}
