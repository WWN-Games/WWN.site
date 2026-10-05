<script lang="ts">
/* ============================================================================
   WWN — интерактив базы данных: табы, поиск, фильтры, сортировка, теги.
   Карточки не рендерятся заново: остров только показывает/скрывает и
   переставляет готовый статический DOM по data-card-id.
   ============================================================================ */

import { onMount } from "svelte";

import type {
  ExplorerFaction,
  ExplorerItem,
  ExplorerLabels,
  ExplorerTag,
  ExplorerTypes,
  SortKey,
  TabId,
} from "@/lib/database";
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

const TAB_IDS: TabId[] = ["factions", "units", "buildings"];
const SORT_KEYS: SortKey[] = ["name", "cost", "hp", "shield", "dps", "speed", "range"];
const TAG_GROUP_ORDER: Record<ExplorerTag["group"], number> = {
  tier: 0,
  class: 1,
  movement: 2,
  mod: 3,
};

let tab = $state<TabId>("factions");
let searchInput = $state("");
let searchQuery = $state("");
let faction = $state("all");
let type = $state("all");
let sort = $state<SortKey>("name");
let appliedTags = $state<string[]>([]);
let tagDraft = $state<string[]>([]);
let tagOpen = $state(false);
let tagButton = $state<HTMLButtonElement | null>(null);
let tagPanel = $state<HTMLDivElement | null>(null);

/** Сетка, которой уже проиграли анимацию полос. */
let animatedTab: TabId | null = null;

const typeOptions = $derived(types[tab]);
const tabItems = $derived(items.filter((item) => item.tab === tab));
const availableTagIds = $derived(new Set(tabItems.flatMap((item) => item.tags)));

const tagOptions = $derived.by(() =>
  tags
    .filter((tag) => availableTagIds.has(tag.id))
    .map((tag) => ({ id: tag.id, group: tag.group, label: tag.name[lang] }))
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
    tags: { id: string; label: string }[];
  }[] = [];
  for (const option of tagOptions) {
    let group = groups.find((item) => item.id === option.group);
    if (!group) {
      group = { id: option.group, title: labels.tagGroups[option.group], tags: [] };
      groups.push(group);
    }
    group.tags.push({ id: option.id, label: option.label });
  }
  return groups;
});

const visibleIds = $derived.by(() => {
  if (tab === "factions") {
    return factions
      .filter((item) => !searchQuery || item.searchText.includes(searchQuery))
      .map((item) => item.id);
  }
  const filtered = tabItems.filter((item) => {
    if (searchQuery && !item.searchText.includes(searchQuery)) return false;
    if (faction !== "all" && item.faction !== faction) return false;
    if (type !== "all" && item.type !== type) return false;
    return appliedTags.every((id) => item.tags.includes(id));
  });
  if (sort === "name") {
    return [...filtered]
      .sort((a, b) => collator(lang).compare(a.name[lang], b.name[lang]))
      .map((item) => item.id);
  }
  /* const: сужение SortKey должно пережить замыкание сортировщика */
  const key = sort;
  return [...filtered].sort((a, b) => (b[key] || 0) - (a[key] || 0)).map((item) => item.id);
});

const countText = $derived(labels.count.replace("{n}", String(visibleIds.length)));
const tagButtonLabel = $derived(
  appliedTags.length ? `${labels.tag}: ${appliedTags.length}` : labels.tag,
);

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
  for (const id of ids) {
    const card = byId.get(id);
    if (card) grid.append(card);
  }
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

/* Пересчёт позиции панели тегов, пока она открыта. */
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

  tablist?.addEventListener("click", onClick);
  tablist?.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", onHashChange);

  /* Deep-link: #factions / #units / #buildings. */
  const initial = location.hash.replace("#", "");
  if (isTabId(initial) && initial !== tab) activate(initial);

  return () => {
    tablist?.removeEventListener("click", onClick);
    tablist?.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", onHashChange);
  };
});

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

function activate(next: TabId, focus = false): void {
  if (next !== tab) {
    tab = next;
    if (type !== "all" && !types[next].some((option) => option.value === type)) type = "all";
    const available = new Set(
      items.filter((item) => item.tab === next).flatMap((item) => item.tags),
    );
    appliedTags = appliedTags.filter((id) => available.has(id));
    tagDraft = tagDraft.filter((id) => available.has(id));
    try {
      history.replaceState(null, "", `#${next}`);
    } catch {
      /* file:// и песочницы без History API */
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
</script>

<div class="database-explorer">
  <input
    type="search"
    value={searchInput}
    oninput={onSearchInput}
    placeholder={labels.search}
    aria-label={labels.search}
  >

  {#if tab !== "factions"}
    <select bind:value={faction} aria-label={labels.faction}>
      <option value="all">{labels.all}</option>
      {#each factions as item (item.id)}
        <option value={item.id}>{item.name[lang]}</option>
      {/each}
    </select>

    {#if typeOptions.length > 0}
      <select bind:value={type} aria-label={labels.type}>
        <option value="all">{labels.all}</option>
        {#each typeOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    {/if}

    <select bind:value={sort} aria-label={labels.sortLabel}>
      {#each SORT_KEYS as key (key)}
        <option value={key}>{labels.sort[key]}</option>
      {/each}
    </select>
  {/if}

  <output class="database-count database-explorer__count" aria-live="polite">{countText}</output>

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
                {tag.label}
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
</div>

<style>
.database-explorer {
  display: contents;
}

.database-explorer__count {
  flex-basis: 100%;
}
</style>
