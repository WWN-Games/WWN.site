/* ============================================================================
   WWN — чистые функции поиска, фильтрации и сортировки базы.
   Используются Svelte-островом и unit-тестами. Без DOM и без Astro.
   ============================================================================ */

import { hasMatchingWeapon } from "./card-stats";
import type { ExplorerItem, SortDirection, SortKey } from "./database";
import type { TagMatchMode } from "./database-constants";
import { collator, foldSearch } from "./utils";

export interface DatabaseFilters {
  query: string;
  faction: string;
  tags: string[];
  tagMode: TagMatchMode;
  weaponTags: string[];
  weaponTagMode: TagMatchMode;
}

/** Поиск по токенам: «акула пво» находит карточку, где слова идут не подряд. */
export function searchTokens(query: string): string[] {
  return foldSearch(query).trim().split(/\s+/).filter(Boolean);
}

export interface SearchableExplorerItem extends ExplorerItem {
  searchText: string;
}

export function matchesSearch(item: SearchableExplorerItem, tokens: readonly string[]): boolean {
  return tokens.every((token) => item.searchText.includes(token));
}

export function filterItems(
  items: readonly SearchableExplorerItem[],
  filters: DatabaseFilters,
): SearchableExplorerItem[] {
  const tokens = searchTokens(filters.query);
  return items.filter((item) => {
    if (tokens.length && !matchesSearch(item, tokens)) return false;
    if (filters.faction !== "all" && item.faction !== filters.faction) return false;
    if (
      filters.weaponTags.length > 0 &&
      !hasMatchingWeapon(item.weapons, filters.weaponTags, filters.weaponTagMode)
    ) {
      return false;
    }
    if (filters.tags.length === 0) return true;
    const matchesTags =
      filters.tagMode === "any"
        ? filters.tags.some((id) => item.tags.includes(id))
        : filters.tags.every((id) => item.tags.includes(id));
    return matchesTags;
  });
}

/** Сортировка без мутации входного массива; имя — стабильный tie-breaker. */
export function sortItems(
  items: readonly ExplorerItem[],
  sort: SortKey,
  direction: SortDirection,
  lang: "ru" | "en",
): ExplorerItem[] {
  const collate = collator(lang);
  const compareName = (a: ExplorerItem, b: ExplorerItem): number => collate.compare(a.name, b.name);
  const sorted = [...items];
  const sign = direction === "asc" ? 1 : -1;

  if (sort === "name") {
    sorted.sort((a, b) => sign * compareName(a, b));
    return sorted;
  }

  const key = sort;
  sorted.sort((a, b) => {
    const diff = (a[key] ?? 0) - (b[key] ?? 0);
    return diff ? sign * diff : compareName(a, b);
  });
  return sorted;
}
