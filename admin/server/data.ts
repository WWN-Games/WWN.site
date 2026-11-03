import path from "node:path";

import { COLLECTION_FILES, type CollectionName } from "../../src/lib/collections.ts";
import type { Faction, Section, Tag } from "../shared/types.ts";
import { SITE_ROOT } from "./config.ts";
import { HttpError, readJson } from "./http.ts";

export function collectionPath(name: CollectionName): string {
  return path.join(SITE_ROOT, COLLECTION_FILES[name]);
}

export async function readContainer<T extends Record<string, unknown>>(
  name: CollectionName,
): Promise<T> {
  const container = await readJson<T>(collectionPath(name));
  if (container === null || typeof container !== "object" || Array.isArray(container)) {
    throw new HttpError(500, `Файл ${COLLECTION_FILES[name]} должен содержать объект`);
  }
  return container;
}

export async function readItems<T>(name: CollectionName): Promise<T[]> {
  const container = await readContainer<Record<string, unknown>>(name);
  const items = container[name];
  if (!Array.isArray(items)) {
    throw new HttpError(500, `В ${COLLECTION_FILES[name]} нет массива «${name}»`);
  }
  return items as T[];
}

export async function readSections(): Promise<Section[]> {
  const sections = await readItems<Section>("sections");
  return [...sections].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export async function readFactions(): Promise<Faction[]> {
  const factions = await readItems<Faction>("factions");
  return [...factions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export async function readTags(): Promise<Tag[]> {
  const tags = await readItems<Tag>("tags");
  return [...tags].sort((a, b) => a.id.localeCompare(b.id));
}
