<script lang="ts">
  /* ============================================================================
     WWN — модальное сравнение карточек: таблица, лучшие значения, различия,
     фильтр оружия по тегам, удаление колонок и ссылка на текущий набор.
     ============================================================================ */

  import { Close, CloseSmall } from "@icon-park/svg";
  import { onDestroy } from "svelte";

  import { iconSvg } from "@/components/ui/icon";
  import { t } from "@/i18n";
  import { filteredWeaponDps, filterWeapons } from "@/lib/card-stats";
  import {
    bestIndexes,
    COMPARE_GROUPS,
    COMPARE_METRICS,
    type CompareGroup,
    type CompareMetric,
    metricValue,
  } from "@/lib/compare";
  import type { ExplorerItem, ExplorerLabels, ExplorerTag } from "@/lib/database";
  import type { TagMatchMode } from "@/lib/database-constants";
  import type { Lang } from "@/lib/site";
  import { formatTemplate } from "@/lib/utils";

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
    ondetail: (id: string) => void;
  }

  let { open, items, tags, lang, labels, onclose, onremove, onclear, onadd, ondetail }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let onlyDiff = $state(false);
  let shareStatus = $state<"" | "ok" | "error">("");
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  let selectedWeaponTags = $state<string[]>([]);
  let weaponTagMode = $state<TagMatchMode>("all");
  let weaponSort = $state<"order" | "name" | "damage" | "fireDelay" | "dps" | "tags">("order");
  let weaponSortDirection = $state<"asc" | "desc">("desc");

  const tagMap = $derived(new Map(tags.map((tag) => [tag.id, tag.name[lang]])));
  const locale = $derived(lang === "en" ? "en-US" : "ru-RU");
  const formatter = $derived(
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 }),
  );
  const weaponTagOptions = $derived.by(() =>
    tags
      .filter((tag) => tag.group === "weapon" || tag.group === "sector")
      .sort(
        (a, b) =>
          (a.group === "weapon" ? 0 : 1) - (b.group === "weapon" ? 0 : 1) ||
          a.name[lang].localeCompare(b.name[lang], lang),
      )
      .map((tag) => ({ id: tag.id, group: tag.group, label: tag.name[lang] })),
  );

  function tagName(id: string): string {
    return tagMap.get(id) ?? id;
  }

  function weaponsFor(item: ExplorerItem) {
    const list = filterWeapons(item.weapons, selectedWeaponTags, weaponTagMode);
    if (weaponSort === "order") return list;
    const collate = new Intl.Collator(locale);
    const sign = weaponSortDirection === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const diff =
        weaponSort === "name" || weaponSort === "tags"
          ? collate.compare(
              weaponSort === "name" ? a.name : a.tags.map(tagName).join(", "),
              weaponSort === "name" ? b.name : b.tags.map(tagName).join(", "),
            )
          : a[weaponSort] - b[weaponSort];
      return diff ? sign * diff : collate.compare(a.name, b.name);
    });
  }

  function dpsFor(item: ExplorerItem): number {
    return filteredWeaponDps(item.weapons, selectedWeaponTags, weaponTagMode);
  }

  function toggleWeaponTag(id: string): void {
    selectedWeaponTags = selectedWeaponTags.includes(id)
      ? selectedWeaponTags.filter((tag) => tag !== id)
      : [...selectedWeaponTags, id];
  }

  interface Cell {
    display: string;
    sub?: string;
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
    const names = item.tags.map((id) => tagName(id));
    return names.length ? names.join(", ") : "—";
  }

  const identityRows = $derived.by(() => {
    if (items.length < 2) return [];
    const rows = [
      { key: "faction", label: labels.faction, values: items.map((item) => item.factionName) },
      { key: "tags", label: labels.tags, values: items.map(tagText) },
      {
        key: "builder",
        label: labels.builder,
        values: items.map((item) => (item.builder ? "✓" : "—")),
      },
      {
        key: "factories",
        label: labels.factories,
        values: items.map((item) =>
          item.factories.length ? item.factories.map((factory) => factory.name).join(", ") : "—",
        ),
      },
      {
        key: "transports",
        label: labels.transports,
        values: items.map((item) =>
          item.transports.length
            ? item.transports.map((transport) => transport.name).join(", ")
            : "—",
        ),
      },
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
      const values = items.map((item) =>
        metric.key === "dps" ? dpsFor(item) : metricValue(item, metric.key),
      );
      const present = values.filter((value): value is number => value !== null);
      if (!present.length) return [];
      if (
        present.every((value) => value === 0) &&
        metric.key !== "hp" &&
        metric.key !== "shield" &&
        metric.key !== "armor" &&
        metric.key !== "cost" &&
        metric.key !== "energy"
      ) {
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

  const weaponRows = $derived.by(() => {
    if (items.length < 2) return [];
    const maxCount = Math.max(...items.map((item) => weaponsFor(item).length));
    if (maxCount === 0) {
      if (selectedWeaponTags.length === 0) return [];
      return [
        {
          key: "weapon-empty",
          group: "weapons" as const,
          label: labels.weaponFilterEmpty,
          cells: items.map(() => ({ display: "—", best: false })),
        },
      ];
    }
    return Array.from({ length: maxCount }, (_, index) => {
      const cells = items.map((item) => {
        const weapon = weaponsFor(item)[index];
        if (!weapon) return { display: "—", best: false };
        const count = weapon.count > 1 ? ` ×${weapon.count}` : "";
        return {
          display: `${weapon.name}${count}`,
          sub: `${formatter.format(weapon.damage)} / ${formatter.format(weapon.fireDelay)} = ${formatter.format(weapon.dps)} DPS · ${weapon.tags.map(tagName).join(", ") || "—"}`,
          best: false,
        };
      });
      if (onlyDiff && new Set(cells.map((cell) => cell.display + (cell.sub ?? ""))).size <= 1) {
        return null;
      }
      return {
        key: `weapon-${index}`,
        group: "weapons" as const,
        label: formatTemplate(labels.weaponSlot, { n: index + 1 }),
        cells,
      } satisfies Row;
    }).filter((row): row is Row => row !== null);
  });

  const groups = $derived.by(() => {
    const rows = [...identityRows, ...metricRows, ...weaponRows];
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
    return formatTemplate(labels.removeCard, { name });
  }

  async function copyLink(): Promise<void> {
    const value = window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      shareStatus = "ok";
    } catch {
      shareStatus = "error";
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

<dialog
  class="compare-dialog"
  bind:this={dialog}
  aria-labelledby="compareDialogTitle"
  onclose={handleClose}
  onclick={(event) => { if (event.target === dialog) onclose(); }}
>
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

    {#if weaponTagOptions.length > 0}
      <details class="compare-weapon-filter">
        <summary>
          {labels.weaponFilter}{selectedWeaponTags.length ? ` (${selectedWeaponTags.length})` : ""}
        </summary>
        <div class="compare-weapon-filter__body">
          <fieldset class="tag-mode">
            <legend class="visually-hidden">{labels.weaponFilter}</legend>
            <button
              type="button"
              class="tag-mode__btn"
              class:is-active={weaponTagMode === "all"}
              aria-pressed={weaponTagMode === "all"}
              onclick={() => (weaponTagMode = "all")}
            >
              {t(lang, "database.tag.mode.all")}
            </button>
            <button
              type="button"
              class="tag-mode__btn"
              class:is-active={weaponTagMode === "any"}
              aria-pressed={weaponTagMode === "any"}
              onclick={() => (weaponTagMode = "any")}
            >
              {t(lang, "database.tag.mode.any")}
            </button>
          </fieldset>
          <div class="compare-weapon-filter__sort">
            <label>
              <span>{t(lang, "database.weapon.order")}</span>
              <select bind:value={weaponSort}>
                <option value="order">{t(lang, "database.weapon.order")}</option>
                <option value="name">{t(lang, "database.weapon.name")}</option>
                <option value="damage">{t(lang, "database.weapon.damage")}</option>
                <option value="fireDelay">{t(lang, "database.weapon.fireDelay")}</option>
                <option value="dps">{t(lang, "database.weapon.dps")}</option>
                <option value="tags">{t(lang, "database.weapon.tags")}</option>
              </select>
            </label>
            <button
              class="icon-btn compare-weapon-filter__direction"
              type="button"
              aria-label={weaponSortDirection === "asc" ? t(lang, "database.sort.asc") : t(lang, "database.sort.desc")}
              title={weaponSortDirection === "asc" ? t(lang, "database.sort.asc") : t(lang, "database.sort.desc")}
              onclick={() => (weaponSortDirection = weaponSortDirection === "asc" ? "desc" : "asc")}
            >
              {weaponSortDirection === "asc" ? "↑" : "↓"}
            </button>
          </div>
          <div class="compare-weapon-filter__chips">
            {#each weaponTagOptions as tag (tag.id)}
              <button
                type="button"
                class="tag-chip"
                aria-pressed={selectedWeaponTags.includes(tag.id)}
                onclick={() => toggleWeaponTag(tag.id)}
              >
                {tag.label}
              </button>
            {/each}
          </div>
          {#if selectedWeaponTags.length > 0}
            <button class="btn btn--ghost btn--sm" type="button" onclick={() => (selectedWeaponTags = [])}>
              {t(lang, "database.tag.clear")}
            </button>
          {/if}
        </div>
      </details>
    {/if}

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
                    <button
                      class="compare-cardhead__img"
                      type="button"
                      title={t(lang, "database.detail")}
                      aria-label={formatTemplate(t(lang, "database.detail.openUnit"), { name: item.name })}
                      onclick={() => ondetail(item.id)}
                    >
                      {#if item.image}
                        <img
                          src={item.image}
                          alt=""
                          width="96"
                          height="96"
                          loading="lazy"
                          decoding="async"
                        />
                      {:else}
                        {item.initials}
                      {/if}
                    </button>
                    <span class="compare-cardhead__meta">
                      <span class="compare-cardhead__name">{item.name}</span>
                      <span class="compare-cardhead__badges">
                        <span class="compare-cardhead__faction">{item.factionName}</span>
                      </span>
                    </span>
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
                    <td
                      class:is-best={cell.best}
                      style={`--faction-color:${items[index]?.factionColor ?? "var(--cyan)"}`}
                    >
                      {cell.display}
                      {#if cell.sub}<span class="compare-weapon__sub">{cell.sub}</span>{/if}
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
