<script lang="ts">
/* ============================================================================
   WWN — интерактив базы данных: табы, поиск, фильтры, сортировка, теги,
   сравнение карточек. Карточки остаются статическим DOM: остров только
   показывает/скрывает, переставляет их и синхронизирует состояние выбора.
   ============================================================================ */

import { ArrowDown, ArrowUp, CloseSmall, Down, Search } from "@icon-park/svg";
import { onDestroy, onMount } from "svelte";

import CardDetailDialog from "@/components/database/CardDetailDialog.svelte";
import CompareDialog from "@/components/database/CompareDialog.svelte";
import CompareTray from "@/components/database/CompareTray.svelte";
import { iconSvg } from "@/components/ui/icon";
import { barPercent, filteredWeaponDps, formatStat } from "@/lib/card-stats";
import {
  MAX_COMPARE,
  parseCardParam,
  parseCompareParam,
  serializeCardParam,
  serializeCompareParam,
} from "@/lib/compare";
import type {
  ExplorerFaction,
  ExplorerItem,
  ExplorerLabels,
  ExplorerTag,
  StatScaleEntryLike,
} from "@/lib/database";
import {
  type CardTab,
  SORT_KEYS,
  type SortDirection,
  type SortKey,
  TABS,
  type TabId,
  type TagMatchMode,
} from "@/lib/database-constants";
import { filterItems, searchTokens, sortItems } from "@/lib/database-view";
import type { Lang } from "@/lib/site";
import { collator, debounce, formatTemplate, nextFocusIndex } from "@/lib/utils";

interface Props {
  lang: Lang;
  items: ExplorerItem[];
  factions: ExplorerFaction[];
  tags: ExplorerTag[];
  dpsScale: StatScaleEntryLike | null;
  labels: ExplorerLabels;
}

const { lang, items, factions, tags, dpsScale, labels }: Props = $props();

const TAB_IDS: TabId[] = [...TABS];
const TAG_GROUP_ORDER: Record<ExplorerTag["group"], number> = {
  tier: 0,
  class: 1,
  movement: 2,
  mod: 3,
  weapon: 4,
  sector: 5,
};
const STORAGE_KEY = "wwn-db-compare:v1";

const itemById = new Map(items.map((item) => [item.id, item]));

let tab = $state<TabId>("factions");
let searchInput = $state("");
let searchQuery = $state("");
let faction = $state("all");
let sort = $state<SortKey>("name");
let direction = $state<SortDirection>("asc");
let appliedTags = $state<string[]>([]);
let tagDraft = $state<string[]>([]);
let tagMode = $state<TagMatchMode>("all");
let tagModeDraft = $state<TagMatchMode>("all");
let tagOpen = $state(false);
let tagButton = $state<HTMLButtonElement | null>(null);
let tagPanel = $state<HTMLDivElement | null>(null);

let weaponTags = $state<string[]>([]);
let weaponTagDraft = $state<string[]>([]);
let weaponTagMode = $state<TagMatchMode>("all");
let weaponTagModeDraft = $state<TagMatchMode>("all");
let weaponTagOpen = $state(false);
let weaponTagButton = $state<HTMLButtonElement | null>(null);
let weaponTagPanel = $state<HTMLDivElement | null>(null);

let selectedByTab = $state<Record<CardTab, string[]>>({ units: [], buildings: [], misc: [] });
let compareOpen = $state(false);
let compareNotice = $state("");
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let detailItem = $state<ExplorerItem | null>(null);
let detailOpen = $state(false);
let restored = false;

/** Сетка, которой уже проиграли анимацию полос. */
let animatedTab: TabId | null = null;

const weaponTagIds = $derived(
  new Set(tags.filter((tag) => tag.group === "weapon" || tag.group === "sector").map((tag) => tag.id)),
);
const weaponFilterActive = $derived(weaponTags.length > 0);

/* Поисковый текст живёт в data-search статических карточек, а не в props
   острова: так гидратация не парсит десятки килобайт JSON. */
let searchIndex = $state<Record<string, string>>({});
$effect(() => {
  const index: Record<string, string> = {};
  for (const card of document.querySelectorAll<HTMLElement>("[data-card-id]")) {
    const id = card.dataset.cardId;
    if (id) index[id] = card.dataset.search ?? "";
  }
  searchIndex = index;
});

const searchableItems = $derived(
  items.map((item) => ({
    ...item,
    dps: weaponFilterActive
      ? filteredWeaponDps(item.weapons, weaponTags, weaponTagMode)
      : item.dps,
    searchText: searchIndex[item.id] ?? "",
  })),
);
const tabItems = $derived(searchableItems.filter((item) => item.tab === tab));
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

const weaponTagCounts = $derived.by(() => {
  const counts = new Map<string, number>();
  for (const item of tabItems) {
    const seen = new Set<string>();
    for (const weapon of item.weapons) {
      for (const id of weapon.tags) {
        if (seen.has(id)) continue;
        seen.add(id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  return counts;
});

const weaponTagOptions = $derived.by(() =>
  tags
    .filter((tag) => weaponTagIds.has(tag.id))
    .map((tag) => ({
      id: tag.id,
      group: tag.group,
      label: tag.name[lang],
      count: weaponTagCounts.get(tag.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        TAG_GROUP_ORDER[a.group] - TAG_GROUP_ORDER[b.group] ||
        collator(lang).compare(a.label, b.label),
    ),
);

const weaponTagGroups = $derived.by(() => {
  const groups: {
    id: ExplorerTag["group"];
    title: string;
    tags: { id: string; label: string; count: number }[];
  }[] = [];
  for (const option of weaponTagOptions) {
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
    tags: appliedTags,
    tagMode,
    weaponTags,
    weaponTagMode,
  });
  return sortItems(filtered, sort, direction, lang).map((item) => item.id);
});

const total = $derived(tab === "factions" ? factions.length : tabItems.length);
const countText = $derived(
  formatTemplate(labels.count, { n: visibleIds.length, total }),
);
const tagButtonLabel = $derived(
  appliedTags.length
    ? `${labels.tag}: ${appliedTags.length} · ${labels.tagMode[tagMode]}`
    : labels.tag,
);
const weaponTagButtonLabel = $derived(
  weaponTags.length
    ? `${labels.weaponTag}: ${weaponTags.length} · ${labels.tagMode[weaponTagMode]}`
    : labels.weaponTag,
);
const draftPreviewCount = $derived.by(() => {
  if (tab === "factions" || !tagOpen) return 0;
  return filterItems(tabItems, {
    query: searchQuery,
    faction,
    tags: tagDraft,
    tagMode: tagModeDraft,
    weaponTags,
    weaponTagMode,
  }).length;
});
const showTagEmptyHint = $derived(
  tagModeDraft === "all" && tagDraft.length > 1 && draftPreviewCount === 0,
);
const weaponDraftPreviewCount = $derived.by(() => {
  if (tab === "factions" || !weaponTagOpen) return 0;
  return filterItems(tabItems, {
    query: searchQuery,
    faction,
    tags: appliedTags,
    tagMode,
    weaponTags: weaponTagDraft,
    weaponTagMode: weaponTagModeDraft,
  }).length;
});
const showWeaponTagEmptyHint = $derived(
  weaponTagModeDraft === "all" &&
    weaponTagDraft.length > 1 &&
    weaponDraftPreviewCount === 0,
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
  for (const id of weaponTags) {
    const option = weaponTagOptions.find((item) => item.id === id);
    filters.push({
      id: `weapon-tag:${id}`,
      label: option?.label ?? id,
      remove: () => {
        weaponTags = weaponTags.filter((tag) => tag !== id);
        weaponTagDraft = weaponTagDraft.filter((tag) => tag !== id);
      },
    });
  }
  return filters;
});

const directionLabel = $derived(direction === "asc" ? labels.sortAsc : labels.sortDesc);

/* Пересчёт DPS на статических карточках при фильтре по тегам оружия. */
$effect(() => {
  const active = weaponFilterActive;
  const selected = weaponTags;
  const mode = weaponTagMode;
  const scale = dpsScale;
  for (const card of document.querySelectorAll<HTMLElement>("[data-card-id]")) {
    const id = card.dataset.cardId;
    const item = id ? itemById.get(id) : undefined;
    if (!item) continue;
    const dps = active ? filteredWeaponDps(item.weapons, selected, mode) : item.dps;
    const bar = card.querySelector<HTMLElement>('[data-stat="dps"]');
    if (!bar) continue;
    bar.dataset.value = String(dps);
    bar.title = `${labels.dps}: ${formatStat(dps)}`;
    const value = bar.querySelector<HTMLElement>("[data-stat-value]");
    if (value) value.textContent = formatStat(dps);
    const fill = bar.querySelector<HTMLElement>("[data-stat-fill]");
    if (fill) fill.style.setProperty("--w", `${barPercent(dps, scale)}%`);
  }
});

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

/* Позиция панелей тегов, пока они открыты. */
$effect(() => {
  const isTagOpen = tagOpen;
  const isWeaponTagOpen = weaponTagOpen;
  if (!isTagOpen && !isWeaponTagOpen) return;
  const controller = new AbortController();
  const reposition = () => {
    if (isTagOpen) positionPanel(tagButton, tagPanel);
    if (isWeaponTagOpen) positionPanel(weaponTagButton, weaponTagPanel);
  };
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
    if (!id || (cardTab !== "units" && cardTab !== "buildings" && cardTab !== "misc")) continue;
    const isSelected = selection[cardTab].includes(id);
    const item = itemById.get(id);
    const name = item?.name ?? id;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute(
      "aria-label",
      formatTemplate(isSelected ? labels.compare.removeAria : labels.compare.addAria, { name }),
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
  const applyCardFromUrl = (): boolean => {
    const parsed = parseCardParam(new URLSearchParams(location.search).get("card"), itemById);
    if (!parsed) return false;
    const item = itemById.get(parsed.id);
    if (!item) return false;
    activate(parsed.tab);
    detailItem = item;
    detailOpen = true;
    return true;
  };

  const onPageLoad = () => {
    /* ClientRouter обновляет URL после подмены разметки: читаем query
       в следующем кадре, иначе после смены языка можно увидеть старый URL. */
    requestAnimationFrame(() => {
      const compared = applyCompareFromUrl();
      const detailed = applyCardFromUrl();
      if (compared || detailed) {
        syncCompareDom();
        syncUrl();
      }
    });
  };

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const compareButton = target.closest<HTMLButtonElement>("[data-compare-id]");
    if (compareButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = compareButton.dataset.compareId;
      const item = id ? itemById.get(id) : undefined;
      if (item) toggleCompare(item);
      return;
    }

    const detailButton = target.closest<HTMLButtonElement>("[data-detail-id]");
    if (detailButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = detailButton.dataset.detailId;
      const item = id ? itemById.get(id) : undefined;
      if (item) openDetail(item);
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
  document.addEventListener("click", onDocumentClick, true);

  /* Прогрессивное улучшение: без JS карточки остаются статическими. */
  document.documentElement.dataset.dbEnhanced = "true";
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-compare-id], [data-detail-id], [data-desc-toggle], [data-reset-filters]",
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
  const parsedCard = parseCardParam(params.get("card"), itemById);
  if (parsedCard) {
    const item = itemById.get(parsedCard.id);
    if (item) {
      activate(parsedCard.tab);
      detailItem = item;
      detailOpen = true;
    }
  }

  restored = true;
  syncUrl();
  syncCompareDom();

  /* После клиентской навигации URL может обновиться уже после mount. */
  const urlTimer = parsed || parsedCard
    ? undefined
    : setTimeout(() => {
        if (applyCompareFromUrl() || applyCardFromUrl()) {
          syncCompareDom();
          syncUrl();
        }
      }, 80);

  return () => {
    if (urlTimer) clearTimeout(urlTimer);
    tablist?.removeEventListener("click", onClick);
    tablist?.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", onHashChange);
    document.removeEventListener("astro:page-load", onPageLoad);
    document.removeEventListener("click", onDocumentClick, true);
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
    if (detailItem && detailItem.tab !== next) {
      detailItem = null;
      detailOpen = false;
    }
    const available = new Set(
      items.filter((item) => item.tab === next).flatMap((item) => item.tags),
    );
    appliedTags = appliedTags.filter((id) => available.has(id));
    tagDraft = tagDraft.filter((id) => available.has(id));
    if (restored) syncUrl();
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
  searchQuery = value.trim();
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
  appliedTags = [];
  tagDraft = [];
  tagMode = "all";
  tagModeDraft = "all";
  weaponTags = [];
  weaponTagDraft = [];
  weaponTagMode = "all";
  weaponTagModeDraft = "all";
  if (tagPanel?.matches(":popover-open")) tagPanel.hidePopover();
  if (weaponTagPanel?.matches(":popover-open")) weaponTagPanel.hidePopover();
}

function toggleAppliedTagMode(): void {
  tagMode = tagMode === "all" ? "any" : "all";
}

function toggleAppliedWeaponTagMode(): void {
  weaponTagMode = weaponTagMode === "all" ? "any" : "all";
}

function setTagModeDraft(next: TagMatchMode): void {
  tagModeDraft = next;
}

function setWeaponTagModeDraft(next: TagMatchMode): void {
  weaponTagModeDraft = next;
}

function onTagBeforeToggle(event: ToggleEvent): void {
  // Позиционируем панель синхронно до показа: toggle-событие popover асинхронное,
  // и без этого первый видимый кадр рисуется в [0, 0] и панель «прыгает».
  if (event.newState === "open") positionPanel(tagButton, tagPanel);
}

function onTagToggle(event: Event): void {
  const open = (event as ToggleEvent).newState === "open";
  tagOpen = open;
  if (!open) return;
  tagDraft = [...appliedTags];
  tagModeDraft = tagMode;
  positionPanel(tagButton, tagPanel);
  requestAnimationFrame(() => positionPanel(tagButton, tagPanel));
}

function onWeaponTagBeforeToggle(event: ToggleEvent): void {
  if (event.newState === "open") positionPanel(weaponTagButton, weaponTagPanel);
}

function onWeaponTagToggle(event: Event): void {
  const open = (event as ToggleEvent).newState === "open";
  weaponTagOpen = open;
  if (!open) return;
  weaponTagDraft = [...weaponTags];
  weaponTagModeDraft = weaponTagMode;
  positionPanel(weaponTagButton, weaponTagPanel);
  requestAnimationFrame(() => positionPanel(weaponTagButton, weaponTagPanel));
}

function toggleTag(id: string): void {
  tagDraft = tagDraft.includes(id) ? tagDraft.filter((tag) => tag !== id) : [...tagDraft, id];
}

function toggleWeaponTag(id: string): void {
  weaponTagDraft = weaponTagDraft.includes(id)
    ? weaponTagDraft.filter((tag) => tag !== id)
    : [...weaponTagDraft, id];
}

function applyTags(): void {
  appliedTags = [...tagDraft];
  tagMode = tagModeDraft;
  tagPanel?.hidePopover();
}

function applyWeaponTags(): void {
  weaponTags = [...weaponTagDraft];
  weaponTagMode = weaponTagModeDraft;
  weaponTagPanel?.hidePopover();
}

function resetTags(): void {
  tagDraft = [];
  appliedTags = [];
}

function resetWeaponTags(): void {
  weaponTagDraft = [];
  weaponTags = [];
}

function positionPanel(button: HTMLElement | null, panel: HTMLElement | null): void {
  if (!button || !panel) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const gap = 8;
  const preferredMax = Math.min(540, Math.round(window.innerHeight * 0.7));
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap);
  const spaceAbove = Math.max(0, rect.top - gap);
  const flip = spaceBelow < 260 && spaceAbove > spaceBelow;
  const available = flip ? spaceAbove : spaceBelow;
  panel.style.left = `${Math.round(left)}px`;
  panel.style.width = `${Math.round(width)}px`;
  panel.style.maxHeight = `${Math.round(Math.max(180, Math.min(preferredMax, available)))}px`;
  if (flip) {
    panel.style.top = "";
    panel.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
  } else {
    panel.style.bottom = "";
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
  }
}

function readStoredSelection(): Record<CardTab, string[]> {
  const empty: Record<CardTab, string[]> = { units: [], buildings: [], misc: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    for (const tabId of ["units", "buildings", "misc"] as const) {
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

function syncUrl(): void {
  try {
    const url = new URL(location.href);
    url.hash = tab;
    const ids = currentCardTab ? selectedByTab[currentCardTab] : [];
    if (currentCardTab && ids.length) {
      url.searchParams.set("compare", serializeCompareParam(currentCardTab, ids));
    } else {
      url.searchParams.delete("compare");
    }
    if (detailOpen && detailItem) {
      url.searchParams.set("card", serializeCardParam(detailItem.tab, detailItem.id));
    } else {
      url.searchParams.delete("card");
    }
    history.replaceState(null, "", url);
  } catch {
    /* file:// и песочницы без History API */
  }
}

function openDetail(item: ExplorerItem): void {
  detailItem = item;
  detailOpen = true;
  syncUrl();
}

function openDetailById(id: string): void {
  const item = itemById.get(id);
  if (item) openDetail(item);
}

function closeDetail(): void {
  detailOpen = false;
  syncUrl();
}

function toggleDetailCompare(item: ExplorerItem): void {
  toggleCompare(item);
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
    showNotice(formatTemplate(labels.compare.limit, { max: MAX_COMPARE }));
    return;
  } else {
    next = [...list, item.id];
  }
  selectedByTab = { ...selectedByTab, [item.tab]: next };
  if (next.length < 2) compareOpen = false;
  persistSelection();
  syncUrl();
}

function removeCompare(id: string): void {
  const item = itemById.get(id);
  if (!item) return;
  const list = selectedByTab[item.tab].filter((itemId) => itemId !== id);
  selectedByTab = { ...selectedByTab, [item.tab]: list };
  if (list.length < 2) compareOpen = false;
  persistSelection();
  syncUrl();
}

function clearCompare(): void {
  if (!currentCardTab) return;
  selectedByTab = { ...selectedByTab, [currentCardTab]: [] };
  compareOpen = false;
  persistSelection();
  syncUrl();
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

    {#if weaponTagOptions.length > 0}
      <div class="tag-filter tag-filter--weapon">
        <button
          type="button"
          class="wwn-select__btn"
          class:is-open={weaponTagOpen}
          bind:this={weaponTagButton}
          popovertarget="databaseWeaponTagPanel"
          aria-haspopup="dialog"
          aria-expanded={weaponTagOpen}
          aria-controls="databaseWeaponTagPanel"
          aria-label={weaponTagButtonLabel}
        >
          <span class="wwn-select__value">{weaponTagButtonLabel}</span>
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
      {#if appliedTags.length > 0}
        <button
          class="database-active__mode"
          type="button"
          title={labels.tagMode.label}
          aria-label={`${labels.tagMode.label}: ${labels.tagMode[tagMode]}`}
          onclick={toggleAppliedTagMode}
        >
          {labels.tagMode[tagMode]}
        </button>
      {/if}
      {#if weaponTags.length > 0}
        <button
          class="database-active__mode"
          type="button"
          title={labels.tagMode.label}
          aria-label={`${labels.weaponTag}: ${labels.tagMode[weaponTagMode]}`}
          onclick={toggleAppliedWeaponTagMode}
        >
          {labels.tagMode[weaponTagMode]}
        </button>
      {/if}
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
      <fieldset class="tag-mode">
        <legend class="visually-hidden">{labels.tagMode.label}</legend>
        <button
          type="button"
          class="tag-mode__btn"
          class:is-active={tagModeDraft === "all"}
          aria-pressed={tagModeDraft === "all"}
          onclick={() => setTagModeDraft("all")}
        >
          {labels.tagMode.all}
        </button>
        <button
          type="button"
          class="tag-mode__btn"
          class:is-active={tagModeDraft === "any"}
          aria-pressed={tagModeDraft === "any"}
          onclick={() => setTagModeDraft("any")}
        >
          {labels.tagMode.any}
        </button>
      </fieldset>
    </div>
    <p class="tag-panel__mode-hint">
      {tagModeDraft === "all" ? labels.tagMode.allHint : labels.tagMode.anyHint}
    </p>
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
    <div class="tag-panel__preview" role="status" aria-live="polite">
      <span class:is-empty={showTagEmptyHint}>
        {formatTemplate(labels.tagMode.preview, { n: draftPreviewCount })}
      </span>
      {#if showTagEmptyHint}
        <span class="tag-panel__warning">{labels.tagMode.emptyHint}</span>
      {/if}
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

  <div
    class="tag-panel"
    id="databaseWeaponTagPanel"
    popover="auto"
    role="dialog"
    aria-label={labels.weaponTag}
    bind:this={weaponTagPanel}
    onbeforetoggle={onWeaponTagBeforeToggle}
    ontoggle={onWeaponTagToggle}
  >
    <div class="tag-panel__head">
      <span class="tag-panel__title">{labels.weaponTagPanelTitle}</span>
      <fieldset class="tag-mode">
        <legend class="visually-hidden">{labels.tagMode.label}</legend>
        <button
          type="button"
          class="tag-mode__btn"
          class:is-active={weaponTagModeDraft === "all"}
          aria-pressed={weaponTagModeDraft === "all"}
          onclick={() => setWeaponTagModeDraft("all")}
        >
          {labels.tagMode.all}
        </button>
        <button
          type="button"
          class="tag-mode__btn"
          class:is-active={weaponTagModeDraft === "any"}
          aria-pressed={weaponTagModeDraft === "any"}
          onclick={() => setWeaponTagModeDraft("any")}
        >
          {labels.tagMode.any}
        </button>
      </fieldset>
    </div>
    <p class="tag-panel__mode-hint">
      {weaponTagModeDraft === "all" ? labels.tagMode.allHint : labels.tagMode.anyHint}
    </p>
    <div class="tag-panel__body">
      {#each weaponTagGroups as group (group.id)}
        <div class="tag-panel__group">
          <div class="tag-panel__group-title">{group.title}</div>
          <div class="tag-panel__chips">
            {#each group.tags as tag (tag.id)}
              <button
                type="button"
                class="tag-chip"
                aria-pressed={weaponTagDraft.includes(tag.id)}
                onclick={() => toggleWeaponTag(tag.id)}
              >
                {tag.label}<span class="tag-chip__count">{tag.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <div class="tag-panel__preview" role="status" aria-live="polite">
      <span class:is-empty={showWeaponTagEmptyHint}>
        {formatTemplate(labels.tagMode.preview, { n: weaponDraftPreviewCount })}
      </span>
      {#if showWeaponTagEmptyHint}
        <span class="tag-panel__warning">{labels.tagMode.emptyHint}</span>
      {/if}
    </div>
    <div class="tag-panel__foot">
      <button
        type="button"
        class="btn btn--sm tag-panel__reset"
        disabled={weaponTagDraft.length === 0}
        onclick={resetWeaponTags}
      >
        {labels.tagClear}
      </button>
      <button type="button" class="btn btn--cyan btn--sm tag-panel__apply" onclick={applyWeaponTags}>
        {labels.tagApply}{weaponTagDraft.length ? ` (${weaponTagDraft.length})` : ""}
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
    ondetail={openDetailById}
  />

  <CardDetailDialog
    open={detailOpen}
    item={detailItem}
    {tags}
    {lang}
    compared={detailItem ? selectedByTab[detailItem.tab].includes(detailItem.id) : false}
    onclose={closeDetail}
    oncompare={toggleDetailCompare}
    ondetail={openDetailById}
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
