/* ============================================================================
   WWN — чистые помощники сравнения карточек базы.
   Состояние выбора и DOM живут в острове; здесь только данные, URL и правила
   «что считать лучшим». Модуль не зависит от Astro — легко тестируется.
   ============================================================================ */

import type { CardTab, ExplorerItem } from "./database";

export const MAX_COMPARE = 4;

export type CompareMetric =
  | "cost"
  | "energy"
  | "fullCost"
  | "buildTime"
  | "hp"
  | "shield"
  | "armor"
  | "selfRegen"
  | "shieldRegen"
  | "totalHp"
  | "dps"
  | "dpsAll"
  | "range"
  | "speed"
  | "turnSpeed"
  | "dpsPerFullCost"
  | "totalHpPerFullCost";

export type CompareGroup =
  | "identity"
  | "cost"
  | "survival"
  | "offense"
  | "weapons"
  | "mobility"
  | "efficiency";

export type CompareDirection = "higher" | "lower";

export interface CompareMetricDef {
  key: CompareMetric;
  group: CompareGroup;
  direction: CompareDirection;
}

/** Порядок групп и метрик в таблице сравнения. */
export const COMPARE_METRICS: readonly CompareMetricDef[] = [
  { key: "cost", group: "cost", direction: "lower" },
  { key: "energy", group: "cost", direction: "lower" },
  { key: "fullCost", group: "cost", direction: "lower" },
  { key: "buildTime", group: "cost", direction: "lower" },
  { key: "hp", group: "survival", direction: "higher" },
  { key: "shield", group: "survival", direction: "higher" },
  { key: "armor", group: "survival", direction: "higher" },
  { key: "selfRegen", group: "survival", direction: "higher" },
  { key: "shieldRegen", group: "survival", direction: "higher" },
  { key: "totalHp", group: "survival", direction: "higher" },
  { key: "dps", group: "offense", direction: "higher" },
  { key: "dpsAll", group: "offense", direction: "higher" },
  { key: "range", group: "offense", direction: "higher" },
  { key: "speed", group: "mobility", direction: "higher" },
  { key: "turnSpeed", group: "mobility", direction: "higher" },
  { key: "dpsPerFullCost", group: "efficiency", direction: "higher" },
  { key: "totalHpPerFullCost", group: "efficiency", direction: "higher" },
] as const;

export const COMPARE_GROUPS: readonly CompareGroup[] = [
  "identity",
  "cost",
  "survival",
  "offense",
  "weapons",
  "mobility",
  "efficiency",
] as const;

/** Значение метрики; null — параметр неприменим или отсутствует. */
export function metricValue(item: ExplorerItem, key: CompareMetric): number | null {
  switch (key) {
    case "totalHp":
      return item.hp + item.shield;
    case "dps":
    case "dpsAll":
      return item.dps;
    case "dpsPerFullCost":
      return item.fullCost > 0 ? (item.dps / item.fullCost) * 100 : null;
    case "totalHpPerFullCost":
      return item.fullCost > 0 ? ((item.hp + item.shield) / item.fullCost) * 100 : null;
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

export interface CardSelection {
  tab: CardTab;
  id: string;
}

function isCardTab(value: string): value is CardTab {
  return value === "units" || value === "buildings";
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
  if (!isCardTab(tab)) return null;

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

/** `units:ahaosa` → одна карточка для модального окна. */
export function parseCardParam(
  value: string | null,
  items: Map<string, ExplorerItem>,
): CardSelection | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const tab = value.slice(0, separator);
  if (!isCardTab(tab)) return null;
  const id = value.slice(separator + 1).trim();
  if (!id || items.get(id)?.tab !== tab) return null;
  return { tab, id };
}

/** Набор id → значение query-параметра compare. */
export function serializeCompareParam(tab: CardTab, ids: string[]): string {
  return `${tab}:${[...new Set(ids)].slice(0, MAX_COMPARE).join(",")}`;
}

/** Одна карточка → значение query-параметра card. */
export function serializeCardParam(tab: CardTab, id: string): string {
  return `${tab}:${id}`;
}
