<script lang="ts">
/* ============================================================================
   WWN — интерактив базы данных: табы, поиск, фильтры, сортировка, теги,
   сравнение карточек. Карточки остаются статическим DOM: остров только
   показывает/скрывает, переставляет их и синхронизирует состояние выбора.
   ============================================================================ */

import { ArrowDown, ArrowUp, CloseSmall, Down, Search } from "@icon-park/svg";
import { onDestroy, onMount } from "svelte";

import CompareDialog from "@/components/database/CompareDialog.svelte";
import CompareTray from "@/components/database/CompareTray.svelte";
import { iconSvg } from "@/components/ui/icon";
import { MAX_COMPARE, parseCompareParam, serializeCompareParam } from "@/lib/compare";
import type {
  ExplorerFaction,
  ExplorerItem,
  ExplorerLabels,
  ExplorerTag,
  ExplorerTypes,
} from "@/lib/database";
import {
  type CardTab,
  SORT_KEYS,
  type SortDirection,
  type SortKey,
  TABS,
  type TabId,
} from "@/lib/database-constants";
import { filterItems, searchTokens, sortItems } from "@/lib/database-view";
import type { Lang } from "@/lib/site";
import { collator, debounce, foldSearch, nextFocusIndex } from "@/lib/utils";

interface Props {
  lang: Lang;
  items: ExplorerItem[];
  factions: ExplorerFaction[];
  types: ExplorerTypes;
  tags: ExplorerTag[];
  labels: ExplorerLabels;
}

const { lang, items, factions, types, tags, labels }: Props = $props();

const TAB_IDS: TabId[] = [...TABS];
const TAG_GROUP_ORDER: Record<ExplorerTag["group"], number> = {
  tier: 0,
  class: 1,
  movement: 2,
  mod: 3,
};
const STORAGE_KEY = "wwn-db-compare:v1";

const itemById = new Map(items.map((item) => [item.id, item]));

let tab = $state<TabId>("factions");
let searchInput = $state("");
let searchQuery = $state("");
let faction = $state("all");
let type = $state("all");
let sort = $state<SortKey>("name");
let direction = $state<SortDirection>("asc");
let appliedTags = $state<string[]>([]);
let tagDraft = $state<string[]>([]);
let tagOpen = $state(false);
let tagButton = $state<HTMLButtonElement | null>(null);
let tagPanel = $state<HTMLDivElement | null>(null);

let selectedByTab = $state<Record<CardTab, string[]>>({ units: [], buildings: [] });
let compareOpen = $state(false);
let compareNotice = $state("");
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let restored = false;

/** Сетка, которой уже проиграли анимацию полос. */
let animatedTab: TabId | null = null;

const typeOptions = $derived(types[tab]);
const tabItems = $derived(items.filter((item) => item.tab === tab));
const availableTagIds = $derived(new Set(tabItems.flatMap((item) => item.tags)));
const currentCardTab = $derived(tab === "factions" ? null : tab);

const selectedForTab = $derived(currentCardTab ? selectedByTab[currentCardTab] : []);
const selectedItems = $derived(
  selectedForTab.flatMap((id) => {
    const item = itemById.get(id);
    return item ? [item] : [];
  }),
);

const tagCounts = $derived.by(() => {
  const counts = new Map<string, number>();
  for (const item of tabItems) {
    for (const id of item.tags) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
});

const tagOptions = $derived.by(() =>
  tags
    .filter((tag) => availableTagIds.has(tag.id))
    .map((tag) => ({
      id: tag.id,
      group: tag.group,
      label: tag.name[lang],
      count: tagCounts.get(tag.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        TAG_GROUP_ORDER[a.group] - TAG_GROUP_ORDER[b.group] ||
        collator(lang).compare(a.label, b.label),
    ),
);

const tagGroups = $derived.by(() => {
  const groups: {
    id: ExplorerTag["group"];
    title: string;
    tags: { id: string; label: string; count: number }[];
  }[] = [];
  for (const option of tagOptions) {
    let group = groups.find((item) => item.id === option.group);
    if (!group) {
      group = { id: option.group, title: labels.tagGroups[option.group], tags: [] };
      groups.push(group);
    }
    group.tags.push({ id: option.id, label: option.label, count: option.count });
  }
  return groups;
});

const visibleIds = $derived.by(() => {
  const tokens = searchTokens(searchQuery);
  if (tab === "factions") {
    return factions
      .filter((item) => tokens.every((token) => item.searchText.includes(token)))
      .map((item) => item.id);
  }
  const filtered = filterItems(tabItems, {
    query: searchQuery,
    faction,
    type,
    tags: appliedTags,
  });
  return sortItems(filtered, sort, direction, lang).map((item) => item.id);
});

const total = $derived(tab === "factions" ? factions.length : tabItems.length);
const countText = $derived(
  labels.count.replace("{n}", String(visibleIds.length)).replace("{total}", String(total)),
);
const tagButtonLabel = $derived(
  appliedTags.length ? `${labels.tag}: ${appliedTags.length}` : labels.tag,
);

interface ActiveFilter {
  id: string;
  label: string;
  remove: () => void;
}

const activeFilters = $derived.by(() => {
  const filters: ActiveFilter[] = [];
  if (searchInput.trim()) {
    filters.push({
      id: "query",
      label: `«${searchInput.trim()}»`,
      remove: () => {
        searchInput = "";
        searchQuery = "";
      },
    });
  }
  if (tab !== "factions" && faction !== "all") {
    const option = factions.find((item) => item.id === faction);
    filters.push({
      id: "faction",
      label: option?.name[lang] ?? faction,
      remove: () => {
        faction = "all";
      },
    });
  }
  if (tab !== "factions" && type !== "all") {
    const option = typeOptions.find((item) => item.value === type);
    filters.push({
      id: "type",
      label: option?.label ?? type,
      remove: () => {
        type = "all";
      },
    });
  }
  for (const id of appliedTags) {
    const option = tagOptions.find((item) => item.id === id);
    filters.push({
      id: `tag:${id}`,
      label: option?.label ?? id,
      remove: () => {
        appliedTags = appliedTags.filter((tag) => tag !== id);
        tagDraft = tagDraft.filter((tag) => tag !== id);
      },
    });
  }
  return filters;
});

const directionLabel = $derived(direction === "asc" ? labels.sortAsc : labels.sortDesc);

/* Показ/скрытие и перестановка статического DOM; полосы перезапускаются
   одной анимацией при смене вкладки. */
$effect(() => {
  const activeTab = tab;
  const ids = visibleIds;

  for (const current of TAB_IDS) {
    document
      .querySelector<HTMLElement>(`[data-grid="${current}"]`)
      ?.toggleAttribute("hidden", current !== activeTab);
  }

  const grid = document.querySelector<HTMLElement>(`[data-grid="${activeTab}"]`);
  if (!grid) return;

  const byId = new Map<string, HTMLElement>();
  for (const card of grid.querySelectorAll<HTMLElement>("[data-card-id]")) {
    const id = card.dataset.cardId;
    if (id) byId.set(id, card);
  }

  const wanted = new Set(ids);
  for (const [id, card] of byId) card.toggleAttribute("hidden", !wanted.has(id));

  /* Один append фрагмента вместо append() в цикле: меньше reflow. */
  const fragment = document.createDocumentFragment();
  for (const id of ids) {
    const card = byId.get(id);
    if (card) fragment.append(card);
  }
  grid.append(fragment);
  grid.querySelector<HTMLElement>("[data-empty]")?.toggleAttribute("hidden", ids.length > 0);

  if (animatedTab !== activeTab && activeTab !== "factions") {
    grid.classList.remove("is-shown");
    requestAnimationFrame(() => grid.classList.add("is-shown"));
  }
  animatedTab = activeTab;
});

/* Синхронизация статических табов с состоянием (aria + roving tabindex). */
$effect(() => {
  const activeTab = tab;
  for (const button of document.querySelectorAll<HTMLButtonElement>("#databaseTabs .tab")) {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  }
});

/* Позиция панели тегов, пока она открыта. */
$effect(() => {
  if (!tagOpen) return;
  const controller = new AbortController();
  const reposition = () => positionTagPanel();
  window.addEventListener("scroll", reposition, { passive: true, signal: controller.signal });
  window.addEventListener("resize", reposition, { signal: controller.signal });
  return () => controller.abort();
});

/* Нет картинки — показываем инициалы вместо битой иконки. */
$effect(() => {
  const onError = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    const initials = target.dataset.initials;
    if (!initials) return;
    const span = document.createElement("span");
    span.textContent = initials;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", target.alt || initials);
    target.replaceWith(span);
  };
  document.addEventListener("error", onError, true);
  return () => document.removeEventListener("error", onError, true);
});

/* Кнопка сравнения и «показать полностью» — статический DOM вне острова. */
function syncCompareDom(selection: Record<CardTab, string[]> = selectedByTab): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-compare-id]")) {
    const id = button.dataset.compareId;
    const cardTab = button.closest<HTMLElement>(".unit-card")?.dataset.tab;
    if (!id || (cardTab !== "units" && cardTab !== "buildings")) continue;
    const isSelected = selection[cardTab].includes(id);
    const item = itemById.get(id);
    const name = item?.name ?? id;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute(
      "aria-label",
      (isSelected ? labels.compare.removeAria : labels.compare.addAria).replace("{name}", name),
    );
    button.closest(".unit-card")?.classList.toggle("is-compared", isSelected);
  }
}

$effect(() => {
  const selection = selectedByTab;
  syncCompareDom(selection);
});

$effect(() => {
  if (selectedItems.length) document.body.classList.add("has-compare-tray");
  else document.body.classList.remove("has-compare-tray");
});

onMount(() => {
  const tablist = document.getElementById("databaseTabs");
  const buttons = tablist ? [...tablist.querySelectorAll<HTMLButtonElement>(".tab")] : [];

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(".tab[data-tab]");
    const next = button?.dataset.tab;
    if (next && isTabId(next)) activate(next);
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (!buttons.includes(document.activeElement as HTMLButtonElement)) return;
    const index = nextFocusIndex(buttons, event, { axis: "x" });
    const target = buttons[index];
    const next = target?.dataset.tab;
    if (!next || !isTabId(next)) return;
    event.preventDefault();
    activate(next, true);
  };
  const onHashChange = () => {
    const hash = location.hash.replace("#", "");
    if (isTabId(hash) && hash !== tab) activate(hash);
  };
  const applyCompareFromUrl = (): boolean => {
    const parsed = parseCompareParam(
      new URLSearchParams(location.search).get("compare"),
      itemById,
    );
    if (!parsed) return false;
    activate(parsed.tab);
    selectedByTab = { ...selectedByTab, [parsed.tab]: parsed.ids };
    compareOpen = parsed.ids.length >= 2;
    return true;
  };

  const onPageLoad = () => {
    /* ClientRouter обновляет URL после подмены разметки: читаем query
       в следующем кадре, иначе после смены языка можно увидеть старый URL. */
    requestAnimationFrame(() => {
      if (applyCompareFromUrl()) {
        syncCompareDom();
        syncCompareUrl();
      }
    });
  };

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const compareButton = target.closest<HTMLButtonElement>("[data-compare-id]");
    if (compareButton) {
      event.preventDefault();
      const id = compareButton.dataset.compareId;
      const item = id ? itemById.get(id) : undefined;
      if (item) toggleCompare(item);
      return;
    }

    const descButton = target.closest<HTMLButtonElement>("[data-desc-toggle]");
    if (descButton) {
      event.preventDefault();
      const card = descButton.closest(".unit-card");
      const desc = card?.querySelector<HTMLElement>(".unit-card__desc");
      if (!desc) return;
      const expanded = desc.classList.toggle("is-expanded");
      descButton.setAttribute("aria-expanded", String(expanded));
      descButton.textContent = expanded
        ? (descButton.dataset.less ?? "")
        : (descButton.dataset.more ?? "");
      return;
    }

    const resetButton = target.closest<HTMLButtonElement>("[data-reset-filters]");
    if (resetButton) {
      event.preventDefault();
      resetFilters();
    }
  };

  tablist?.addEventListener("click", onClick);
  tablist?.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", onHashChange);
  document.addEventListener("astro:page-load", onPageLoad);
  document.addEventListener("click", onDocumentClick);

  /* Прогрессивное улучшение: без JS карточки остаются статическими. */
  document.documentElement.dataset.dbEnhanced = "true";
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-compare-id], [data-desc-toggle], [data-reset-filters]",
  )) {
    element.hidden = false;
  }

  const params = new URLSearchParams(location.search);
  const parsed = parseCompareParam(params.get("compare"), itemById);
  if (parsed) {
    activate(parsed.tab);
    selectedByTab = { ...selectedByTab, [parsed.tab]: parsed.ids };
    compareOpen = parsed.ids.length >= 2;
  } else {
    selectedByTab = readStoredSelection();
    const initial = location.hash.replace("#", "");
    if (isTabId(initial)) activate(initial);
  }

  restored = true;
  syncCompareUrl();
  syncCompareDom();

  /* После клиентской навигации URL может обновиться уже после mount. */
  const urlTimer = parsed
    ? undefined
    : setTimeout(() => {
        if (applyCompareFromUrl()) {
          syncCompareDom();
          syncCompareUrl();
        }
      }, 80);

  return () => {
    if (urlTimer) clearTimeout(urlTimer);
    tablist?.removeEventListener("click", onClick);
    tablist?.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", onHashChange);
    document.removeEventListener("astro:page-load", onPageLoad);
    document.removeEventListener("click", onDocumentClick);
    document.body.classList.remove("has-compare-tray");
    delete document.documentElement.dataset.dbEnhanced;
    runSearch.cancel();
    if (noticeTimer) clearTimeout(noticeTimer);
  };
});

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

function factionCount(item: ExplorerFaction, tabId: TabId): number {
  return tabId === "factions" ? 0 : item.counts[tabId];
}

function activate(next: TabId, focus = false): void {
  if (next !== tab) {
    tab = next;
    compareOpen = false;
    if (type !== "all" && !types[next].some((option) => option.value === type)) type = "all";
    const available = new Set(
      items.filter((item) => item.tab === next).flatMap((item) => item.tags),
    );
    appliedTags = appliedTags.filter((id) => available.has(id));
    tagDraft = tagDraft.filter((id) => available.has(id));
    if (restored) syncCompareUrl();
    else {
      try {
        const url = new URL(location.href);
        url.hash = next;
        history.replaceState(null, "", url);
      } catch {
        /* file:// и песочницы без History API */
      }
    }
  }
  if (focus) document.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
}

const runSearch = debounce((value: string) => {
  searchQuery = foldSearch(value.trim());
}, 140);

function onSearchInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  searchInput = input.value;
  runSearch(input.value);
}

function clearSearch(): void {
  runSearch.cancel();
  searchInput = "";
  searchQuery = "";
}

function onSortChange(event: Event): void {
  const next = (event.currentTarget as HTMLSelectElement).value as SortKey;
  sort = next;
  direction = next === "name" ? "asc" : "desc";
}

function toggleDirection(): void {
  direction = direction === "asc" ? "desc" : "asc";
}

function resetFilters(): void {
  runSearch.cancel();
  searchInput = "";
  searchQuery = "";
  faction = "all";
  type = "all";
  appliedTags = [];
  tagDraft = [];
  if (tagPanel?.matches(":popover-open")) tagPanel.hidePopover();
}

function onTagBeforeToggle(event: ToggleEvent): void {
  // Позиционируем панель синхронно до показа: toggle-событие popover асинхронное,
  // и без этого первый видимый кадр рисуется в [0, 0] и панель «прыгает».
  if (event.newState === "open") positionTagPanel();
}

function onTagToggle(event: Event): void {
  const open = (event as ToggleEvent).newState === "open";
  tagOpen = open;
  if (!open) return;
  tagDraft = [...appliedTags];
  positionTagPanel();
  requestAnimationFrame(positionTagPanel);
}

function toggleTag(id: string): void {
  tagDraft = tagDraft.includes(id) ? tagDraft.filter((tag) => tag !== id) : [...tagDraft, id];
}

function applyTags(): void {
  appliedTags = [...tagDraft];
  tagPanel?.hidePopover();
}

function resetTags(): void {
  tagDraft = [];
  appliedTags = [];
}

function positionTagPanel(): void {
  const button = tagButton;
  const panel = tagPanel;
  if (!button || !panel) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const height = panel.getBoundingClientRect().height || 420;
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < Math.min(height, 240) && rect.top > spaceBelow;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.width = `${Math.round(width)}px`;
  if (flip) {
    panel.style.top = "";
    panel.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
  } else {
    panel.style.bottom = "";
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
  }
}

function readStoredSelection(): Record<CardTab, string[]> {
  const empty: Record<CardTab, string[]> = { units: [], buildings: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    for (const tabId of ["units", "buildings"] as const) {
      const value = (parsed as Record<string, unknown>)[tabId];
      if (!Array.isArray(value)) continue;
      empty[tabId] = [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === "string" && itemById.get(id)?.tab === tabId,
          ),
        ),
      ].slice(0, MAX_COMPARE);
    }
  } catch {
    // приватный режим / повреждённое хранилище — просто пустой выбор
  }
  return empty;
}

function persistSelection(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedByTab));
  } catch {
    // приватный режим — выбор работает до перезагрузки
  }
}

function syncCompareUrl(): void {
  try {
    const url = new URL(location.href);
    url.hash = tab;
    const ids = currentCardTab ? selectedByTab[currentCardTab] : [];
    if (currentCardTab && ids.length) {
      url.searchParams.set("compare", serializeCompareParam(currentCardTab, ids));
    } else {
      url.searchParams.delete("compare");
    }
    history.replaceState(null, "", url);
  } catch {
    /* file:// и песочницы без History API */
  }
}

function showNotice(message: string): void {
  compareNotice = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    compareNotice = "";
    noticeTimer = undefined;
  }, 2600);
}

function toggleCompare(item: ExplorerItem): void {
  const list = selectedByTab[item.tab];
  let next = list;
  if (list.includes(item.id)) {
    next = list.filter((id) => id !== item.id);
  } else if (list.length >= MAX_COMPARE) {
    showNotice(labels.compare.limit.replace("{max}", String(MAX_COMPARE)));
    return;
  } else {
    next = [...list, item.id];
  }
  selectedByTab = { ...selectedByTab, [item.tab]: next };
  if (next.length < 2) compareOpen = false;
  persistSelection();
  syncCompareUrl();
}

function removeCompare(id: string): void {
  const item = itemById.get(id);
  if (!item) return;
  const list = selectedByTab[item.tab].filter((itemId) => itemId !== id);
  selectedByTab = { ...selectedByTab, [item.tab]: list };
  if (list.length < 2) compareOpen = false;
  persistSelection();
  syncCompareUrl();
}

function clearCompare(): void {
  if (!currentCardTab) return;
  selectedByTab = { ...selectedByTab, [currentCardTab]: [] };
  compareOpen = false;
  persistSelection();
  syncCompareUrl();
}

function openCompare(): void {
  if (selectedItems.length >= 2) compareOpen = true;
}

function closeCompare(): void {
  compareOpen = false;
}

function addAnother(): void {
  compareOpen = false;
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(
        `#databaseGrid-${tab} .unit-card:not(.is-compared) [data-compare-id]`,
      )
      ?.focus();
  });
}

onDestroy(() => {
  if (typeof document === "undefined") return;
  document.body.classList.remove("has-compare-tray");
  delete document.documentElement.dataset.dbEnhanced;
  runSearch.cancel();
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<div class="database-explorer">
  <div class="database-search">
    {@html iconSvg(Search, "database-search__icon")}
    <input
      type="search"
      value={searchInput}
      oninput={onSearchInput}
      placeholder={labels.search}
      aria-label={labels.search}
    >
    {#if searchInput}
      <button
        class="database-search__clear"
        type="button"
        aria-label={labels.clearSearch}
        onclick={clearSearch}
      >
        {@html iconSvg(CloseSmall)}
      </button>
    {/if}
  </div>

  {#if tab !== "factions"}
    <span class="select-field">
      <select bind:value={faction} aria-label={labels.faction}>
        <option value="all">{labels.all}</option>
        {#each factions as item (item.id)}
          <option value={item.id}>{item.name[lang]} ({factionCount(item, tab)})</option>
        {/each}
      </select>
      {@html iconSvg(Down, "select-field__chevron")}
    </span>

    {#if typeOptions.length > 0}
      <span class="select-field">
        <select bind:value={type} aria-label={labels.type}>
          <option value="all">{labels.all}</option>
          {#each typeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {@html iconSvg(Down, "select-field__chevron")}
      </span>
    {/if}

    {#if tagOptions.length > 0}
      <div class="tag-filter">
        <button
          type="button"
          class="wwn-select__btn"
          class:is-open={tagOpen}
          bind:this={tagButton}
          popovertarget="databaseTagPanel"
          aria-haspopup="dialog"
          aria-expanded={tagOpen}
          aria-controls="databaseTagPanel"
          aria-label={tagButtonLabel}
        >
          <span class="wwn-select__value">{tagButtonLabel}</span>
          {@html iconSvg(Down)}
        </button>
      </div>
    {/if}

    <span class="select-field select-field--sort">
      <select value={sort} onchange={onSortChange} aria-label={labels.sortLabel}>
        {#each SORT_KEYS as key (key)}
          <option value={key}>{labels.sort[key]}</option>
        {/each}
      </select>
      {@html iconSvg(Down, "select-field__chevron")}
    </span>

    <button
      class="icon-btn database-explorer__direction"
      type="button"
      aria-label={directionLabel}
      title={directionLabel}
      onclick={toggleDirection}
    >
      {@html iconSvg(direction === "asc" ? ArrowUp : ArrowDown)}
    </button>
  {/if}

  <output class="database-count database-explorer__count" aria-live="polite">{countText}</output>

  {#if activeFilters.length > 0}
    <fieldset class="database-active">
      <legend class="visually-hidden">{labels.resetFilters}</legend>
      {#each activeFilters as active (active.id)}
        <button class="database-active__chip" type="button" onclick={active.remove}>
          <span>{active.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      {/each}
      <button class="database-active__reset" type="button" onclick={resetFilters}>
        {labels.resetFilters}
      </button>
    </fieldset>
  {/if}

  <p class="database-explorer__notice" role="status" aria-live="polite" hidden={!compareNotice}>
    {compareNotice}
  </p>

  <div
    class="tag-panel"
    id="databaseTagPanel"
    popover="auto"
    role="dialog"
    aria-label={labels.tag}
    bind:this={tagPanel}
    onbeforetoggle={onTagBeforeToggle}
    ontoggle={onTagToggle}
  >
    <div class="tag-panel__head">
      <span class="tag-panel__title">{labels.tagPanelTitle}</span>
    </div>
    <div class="tag-panel__body">
      {#each tagGroups as group (group.id)}
        <div class="tag-panel__group">
          <div class="tag-panel__group-title">{group.title}</div>
          <div class="tag-panel__chips">
            {#each group.tags as tag (tag.id)}
              <button
                type="button"
                class="tag-chip"
                aria-pressed={tagDraft.includes(tag.id)}
                onclick={() => toggleTag(tag.id)}
              >
                {tag.label}<span class="tag-chip__count">{tag.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <div class="tag-panel__foot">
      <button
        type="button"
        class="btn btn--sm tag-panel__reset"
        disabled={tagDraft.length === 0}
        onclick={resetTags}
      >
        {labels.tagClear}
      </button>
      <button type="button" class="btn btn--cyan btn--sm tag-panel__apply" onclick={applyTags}>
        {labels.tagApply}{tagDraft.length ? ` (${tagDraft.length})` : ""}
      </button>
    </div>
  </div>

  {#if selectedItems.length > 0}
    <CompareTray
      items={selectedItems}
      labels={labels.compare}
      max={MAX_COMPARE}
      onopen={openCompare}
      onclear={clearCompare}
      onremove={removeCompare}
    />
  {/if}

  <CompareDialog
    open={compareOpen}
    items={selectedItems}
    {tags}
    {lang}
    labels={labels.compare}
    onclose={closeCompare}
    onremove={removeCompare}
    onclear={clearCompare}
    onadd={addAnother}
  />
</div>

<style>
.database-explorer {
  display: contents;
}

.database-explorer__count {
  flex-basis: 100%;
}
</style>
