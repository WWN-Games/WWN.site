import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ROOT = path.resolve(ADMIN_ROOT, "..");

export const HOST = process.env.ADMIN_HOST ?? "127.0.0.1";
export const PORT = Number(process.env.ADMIN_PORT ?? 4322);
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://127.0.0.1:4321";
export const SITE_BASE = "/WWN.site";
export const SITE_DEV_URL = `${SITE_ORIGIN}${SITE_BASE}`;
