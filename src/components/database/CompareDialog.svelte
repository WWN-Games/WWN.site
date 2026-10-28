<script lang="ts">
/* ============================================================================
   WWN — модальное сравнение карточек: таблица, лучшие значения, различия,
   удаление колонок и копирование ссылки на текущий набор.
   ============================================================================ */

import { Close, CloseSmall } from "@icon-park/svg";
import { onDestroy } from "svelte";

import { iconSvg } from "@/components/ui/icon";
import {
  bestIndexes,
  COMPARE_GROUPS,
  COMPARE_METRICS,
  type CompareGroup,
  type CompareMetric,
  metricValue,
} from "@/lib/compare";
import type { ExplorerItem, ExplorerLabels, ExplorerTag } from "@/lib/database";
import type { Lang } from "@/lib/site";

interface Props {
  open: boolean;
  items: ExplorerItem[];
  tags: ExplorerTag[];
  lang: Lang;
  labels: ExplorerLabels["compare"];
  onclose: () => void;
  onremove: (id: string) => void;
  onclear: () => void;
  onadd: () => void;
}

let { open, items, tags, lang, labels, onclose, onremove, onclear, onadd }: Props = $props();

let dialog = $state<HTMLDialogElement | null>(null);
let onlyDiff = $state(false);
let shareStatus = $state<"" | "ok" | "error">("");
let shareTimer: ReturnType<typeof setTimeout> | undefined;

const tagMap = $derived(new Map(tags.map((tag) => [tag.id, tag.name[lang]])));
const locale = $derived(lang === "en" ? "en-US" : "ru-RU");
const formatter = $derived(
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 }),
);

interface Cell {
  display: string;
  best: boolean;
}

interface Row {
  key: string;
  group: CompareGroup;
  label: string;
  cells: Cell[];
}

function formatMetric(value: number | null, key: CompareMetric): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (key === "buildTime" && value <= 0) return "—";
  return formatter.format(value);
}

function tagText(item: ExplorerItem): string {
  const names = item.tags.map((id) => tagMap.get(id) ?? id);
  return names.length ? names.join(", ") : "—";
}

const identityRows = $derived.by(() => {
  if (items.length < 2) return [];
  const rows = [
    { key: "faction", label: labels.faction, values: items.map((item) => item.factionName) },
    { key: "type", label: labels.type, values: items.map((item) => item.typeLabel) },
    { key: "tags", label: labels.tags, values: items.map(tagText) },
  ];
  return rows
    .filter((row) => !onlyDiff || new Set(row.values).size > 1)
    .map((row) => ({
      key: row.key,
      group: "identity" as const,
      label: row.label,
      cells: row.values.map((display) => ({ display, best: false })),
    }));
});

const metricRows = $derived.by(() => {
  if (items.length < 2) return [];
  return COMPARE_METRICS.flatMap((metric) => {
    const values = items.map((item) => metricValue(item, metric.key));
    const present = values.filter((value): value is number => value !== null);
    if (!present.length) return [];
    if (present.every((value) => value === 0) && metric.key !== "hp" && metric.key !== "shield") {
      return [];
    }
    const best = bestIndexes(values, metric.direction);
    const cells = values.map((value, index) => ({
      display: formatMetric(value, metric.key),
      best: best.includes(index),
    }));
    if (onlyDiff && new Set(values.map((value) => value ?? "null")).size <= 1) return [];
    return [
      {
        key: metric.key,
        group: metric.group,
        label: labels.metric[metric.key],
        cells,
      } satisfies Row,
    ];
  });
});

const groups = $derived.by(() => {
  const rows = [...identityRows, ...metricRows];
  return COMPARE_GROUPS.map((group) => ({
    group,
    title: labels.group[group],
    rows: rows.filter((row) => row.group === group),
  })).filter((group) => group.rows.length > 0);
});

const noDiff = $derived(onlyDiff && groups.length === 0);

$effect(() => {
  const element = dialog;
  if (!element) return;
  if (open && !element.open) {
    element.showModal();
    shareStatus = "";
  } else if (!open && element.open) {
    element.close();
  }
});

function handleClose(): void {
  if (open) onclose();
}

function removeLabel(name: string): string {
  return labels.removeCard.replace("{name}", name);
}

async function copyLink(): Promise<void> {
  const value = window.location.href;
  try {
    await navigator.clipboard.writeText(value);
    shareStatus = "ok";
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      shareStatus = document.execCommand("copy") ? "ok" : "error";
      textarea.remove();
    } catch {
      shareStatus = "error";
    }
  }
  if (shareTimer) clearTimeout(shareTimer);
  shareTimer = setTimeout(() => {
    shareStatus = "";
    shareTimer = undefined;
  }, 2600);
}

onDestroy(() => {
  if (shareTimer) clearTimeout(shareTimer);
});
</script>

<dialog class="compare-dialog" bind:this={dialog} aria-labelledby="compareDialogTitle" onclose={handleClose}>
  <div class="compare-dialog__panel">
    <header class="compare-dialog__head">
      <div class="compare-dialog__heading">
        <span class="kicker">{labels.title}</span>
        <h2 id="compareDialogTitle">{labels.dialogTitle}</h2>
      </div>
      <div class="compare-dialog__tools">
        <label class="compare-switch">
          <input type="checkbox" bind:checked={onlyDiff}>
          <span>{labels.onlyDiff}</span>
        </label>
        <button class="btn btn--sm" type="button" onclick={copyLink}>{labels.share}</button>
        <button class="icon-btn compare-dialog__close" type="button" aria-label={labels.close} onclick={onclose}>
          {@html iconSvg(Close)}
        </button>
      </div>
    </header>

    <p class="compare-dialog__status" role="status" aria-live="polite">
      {shareStatus === "ok" ? labels.shared : shareStatus === "error" ? labels.shareError : ""}
    </p>

    {#if items.length < 2}
      <div class="empty-block">{labels.noDiff}</div>
    {:else if noDiff}
      <div class="empty-block">{labels.noDiff}</div>
    {:else}
      <!-- biome-ignore lint/a11y/noNoninteractiveTabindex: горизонтально прокручиваемая таблица должна быть доступна с клавиатуры -->
      <section class="compare-table-wrap" tabindex="0" aria-label={labels.dialogTitle}>
        <table class="compare-table">
          <caption class="visually-hidden">{labels.dialogTitle}</caption>
          <thead>
            <tr>
              <th class="compare-table__label" scope="col">{labels.column}</th>
              {#each items as item (item.id)}
                <th scope="col" style={`--faction-color:${item.factionColor}`}>
                  <div class="compare-cardhead">
                    <button
                      class="compare-cardhead__remove"
                      type="button"
                      aria-label={removeLabel(item.name)}
                      onclick={() => onremove(item.id)}
                    >
                      {@html iconSvg(CloseSmall)}
                    </button>
                    <span class="compare-cardhead__img">
                      {#if item.image}
                        <img
                          src={item.image}
                          alt=""
                          width="64"
                          height="64"
                          loading="lazy"
                          decoding="async"
                        />
                      {:else}
                        {item.initials}
                      {/if}
                    </span>
                    <span class="compare-cardhead__name">{item.name}</span>
                    <span class="compare-cardhead__faction">{item.factionName}</span>
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each groups as group (group.group)}
              <tr class="compare-table__group">
                <th scope="col" colspan={items.length + 1}>{group.title}</th>
              </tr>
              {#each group.rows as row (row.key)}
                <tr>
                  <th scope="row">{row.label}</th>
                  {#each row.cells as cell, index (items[index]?.id ?? index)}
                    <td class:is-best={cell.best}>
                      {cell.display}
                      {#if cell.best}
                        <span class="visually-hidden"> — {labels.best}</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    <footer class="compare-dialog__foot">
      <button class="btn btn--sm" type="button" onclick={onclear}>{labels.clear}</button>
      <button class="btn btn--sm" type="button" onclick={onadd}>{labels.addAnother}</button>
    </footer>
  </div>
</dialog>
