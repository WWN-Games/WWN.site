/* ============================================================================
   WWN — чистые помощники сравнения карточек базы.
   Состояние выбора и DOM живут в острове; здесь только данные, URL и правила
   «что считать лучшим». Модуль не зависит от Astro — легко тестируется.
   ============================================================================ */

import type { CardTab, ExplorerItem } from "./database";

export const MAX_COMPARE = 4;

export type CompareMetric =
  | "cost"
  | "buildTime"
  | "hp"
  | "shield"
  | "totalHp"
  | "dps"
  | "range"
  | "speed"
  | "dpsPerCost"
  | "hpPerCost";

export type CompareGroup = "identity" | "cost" | "survival" | "offense" | "mobility" | "efficiency";

export type CompareDirection = "higher" | "lower";

export interface CompareMetricDef {
  key: CompareMetric;
  group: CompareGroup;
  direction: CompareDirection;
}

/** Порядок групп и метрик в таблице сравнения. */
export const COMPARE_METRICS: readonly CompareMetricDef[] = [
  { key: "cost", group: "cost", direction: "lower" },
  { key: "buildTime", group: "cost", direction: "lower" },
  { key: "hp", group: "survival", direction: "higher" },
  { key: "shield", group: "survival", direction: "higher" },
  { key: "totalHp", group: "survival", direction: "higher" },
  { key: "dps", group: "offense", direction: "higher" },
  { key: "range", group: "offense", direction: "higher" },
  { key: "speed", group: "mobility", direction: "higher" },
  { key: "dpsPerCost", group: "efficiency", direction: "higher" },
  { key: "hpPerCost", group: "efficiency", direction: "higher" },
] as const;

export const COMPARE_GROUPS: readonly CompareGroup[] = [
  "identity",
  "cost",
  "survival",
  "offense",
  "mobility",
  "efficiency",
] as const;

/** Значение метрики; null — параметр неприменим или отсутствует. */
export function metricValue(item: ExplorerItem, key: CompareMetric): number | null {
  switch (key) {
    case "totalHp":
      return item.hp + item.shield;
    case "dpsPerCost":
      return item.cost > 0 ? (item.dps / item.cost) * 100 : null;
    case "hpPerCost":
      return item.cost > 0 ? (item.hp / item.cost) * 100 : null;
    case "buildTime":
      return item.buildTime > 0 ? item.buildTime : null;
    default: {
      const value = item[key];
      return Number.isFinite(value) ? value : null;
    }
  }
}

/** Индексы лучших значений. Ничьи подсвечиваются все; при равенстве — пусто. */
export function bestIndexes(values: (number | null)[], direction: CompareDirection): number[] {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return [];
  const best = direction === "higher" ? Math.max(...present) : Math.min(...present);
  if (present.every((value) => value === best)) return [];
  return values.flatMap((value, index) => (value === best ? [index] : []));
}

export interface CompareSelection {
  tab: CardTab;
  ids: string[];
}

/** `units:ahaosa,argo` → проверенный набор id (не более MAX_COMPARE). */
export function parseCompareParam(
  value: string | null,
  items: Map<string, ExplorerItem>,
): CompareSelection | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const tab = value.slice(0, separator);
  if (tab !== "units" && tab !== "buildings") return null;

  const ids = [
    ...new Set(
      value
        .slice(separator + 1)
        .split(",")
        .map((id) => id.trim()),
    ),
  ]
    .filter(Boolean)
    .filter((id) => items.get(id)?.tab === tab)
    .slice(0, MAX_COMPARE);

  return ids.length ? { tab, ids } : null;
}

/** Набор id → значение query-параметра compare. */
export function serializeCompareParam(tab: CardTab, ids: string[]): string {
  return `${tab}:${[...new Set(ids)].slice(0, MAX_COMPARE).join(",")}`;
}
