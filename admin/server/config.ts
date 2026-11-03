import path from "node:path";
import { fileURLToPath } from "node:url";

import { BASE } from "../../src/lib/site.ts";

export const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ROOT = path.resolve(ADMIN_ROOT, "..");

export const HOST = process.env.ADMIN_HOST ?? "127.0.0.1";
export const PORT = Number(process.env.ADMIN_PORT ?? 4322);
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://127.0.0.1:4321";
export const SITE_BASE = BASE;
export const SITE_DEV_URL = `${SITE_ORIGIN}${SITE_BASE}`;

export const IS_LOOPBACK_HOST = HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";

/** Дополнительные origin для ADMIN_HOST вне loopback: ADMIN_ORIGIN=http://192.168.1.10:4322 */
export const EXTRA_ORIGINS = (process.env.ADMIN_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
