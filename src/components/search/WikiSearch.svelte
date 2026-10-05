<script lang="ts">
import { X } from "phosphor-svelte";
import { onDestroy, onMount } from "svelte";
import type { Lang } from "@/i18n";
import {
  highlight,
  isLangUrl,
  loadPagefind,
  type PagefindResultData,
  resetPagefind,
  sectionCounts,
  sectionOf,
  stripBase,
  withBase,
} from "@/lib/search";
import { debounce, nextFocusIndex } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
}

interface Labels {
  title: string;
  placeholder: string;
  close: string;
  hint: string;
  found: string;
  all: string;
  recent: string;
  empty: string;
  more: string;
  loadError: string;
}

interface Props {
  lang: Lang;
  sections: Section[];
  labels: Labels;
}

interface FoundItem {
  href: string;
  title: string;
  sectionTitle: string;
  excerpt: string;
}

let { lang, sections, labels }: Props = $props();

/** Подстановка {n} и других плейсхолдеров в строки, переданные с сервера. */
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

const RECENT_KEY = "wwn-wiki-search";
const RECENT_MAX = 5;
const RESULT_LIMIT = 12;
const SEARCH_DELAY = 160;

let panel = $state<HTMLDialogElement | null>(null);
let panelInput = $state<HTMLInputElement | null>(null);
let resultsBox = $state<HTMLDivElement | null>(null);

let query = $state("");
let items = $state<FoundItem[]>([]);
let counts = $state<Record<string, number>>({});
let recents = $state<string[]>([]);
let activeSection = $state("");
let expanded = $state(false);
let loading = $state(false);
let failed = $state(false);

/* Гонки: ответ устаревшего запроса отбрасывается по номеру. */
let searchSeq = 0;
let destroyed = false;

const shortQuery = $derived(query.trim().length < 2);
const foundCount = $derived(items.length);
const hiddenCount = $derived(Math.max(0, items.length - RESULT_LIMIT));
const visible = $derived(expanded ? items : items.slice(0, RESULT_LIMIT));
/* Как в legacy: в чипах только разделы с совпадениями, с числом результатов. */
const filterSections = $derived(sections.filter((section) => (counts[section.id] ?? 0) > 0));
const hintText = $derived(
  shortQuery
    ? labels.hint
    : failed
      ? ""
      : fmt(labels.found, { n: foundCount }),
);

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function rememberQuery(value: string): void {
  const trimmed = value.trim();
  if (trimmed.length < 2) return;
  recents = [trimmed, ...recents.filter((recent) => recent !== trimmed)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  } catch {
    // приватный режим — недавние просто не сохранятся
  }
}

function toFound(data: PagefindResultData, term: string): FoundItem {
  const sectionId = sectionOf(data);
  return {
    href: withBase(data.url),
    title: highlight(data.meta?.title ?? stripBase(data.url), term),
    sectionTitle: sections.find((section) => section.id === sectionId)?.title ?? "",
    excerpt: data.excerpt ?? "",
  };
}

async function runSearch(): Promise<void> {
  if (destroyed) return;
  const term = query.trim();
  const seq = ++searchSeq;
  expanded = false;

  if (term.length < 2) {
    items = [];
    counts = {};
    failed = false;
    loading = false;
    return;
  }

  loading = true;
  failed = false;

  try {
    const pagefind = await loadPagefind(lang);
    if (seq !== searchSeq) return;

    const response = await pagefind.search(
      term,
      activeSection ? { filters: { section: activeSection } } : undefined,
    );
    if (seq !== searchSeq) return;

    const data = await Promise.all(response.results.map((result) => result.data()));
    if (seq !== searchSeq) return;

    const found = data.filter((entry) => isLangUrl(entry.url, lang));
    counts = sectionCounts(response);
    items = found.map((entry) => toFound(entry, term));
    loading = false;
  } catch {
    if (seq !== searchSeq) return;
    items = [];
    counts = {};
    failed = true;
    loading = false;
    void resetPagefind();
  }
}

const debouncedSearch = debounce(() => {
  void runSearch();
}, SEARCH_DELAY);

function openDialog(seed = ""): void {
  // как в legacy: панель всегда открывается с запросом-сидом (обычно пустым)
  if (seed || query) query = seed;
  if (panelInput) panelInput.value = query;
  activeSection = "";
  expanded = false;
  if (panel && !panel.open) panel.showModal();
  panelInput?.focus();
  panelInput?.select();
  void runSearch();
}

function closeDialog(): void {
  panel?.close();
}

function onPanelClick(event: MouseEvent): void {
  if (event.target === panel) closeDialog();
}

function selectSection(id: string): void {
  activeSection = activeSection === id ? "" : id;
  expanded = false;
  void runSearch();
}

function useRecent(value: string): void {
  query = value;
  if (panelInput) panelInput.value = value;
  panelInput?.focus();
  void runSearch();
}

function onInputKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    rememberQuery(query);
    void runSearch();
    return;
  }
  if (event.key !== "ArrowDown") return;
  const first = resultsBox?.querySelector<HTMLElement>(".search-result");
  if (!first) return;
  event.preventDefault();
  first.focus();
}

function onResultsKeydown(event: KeyboardEvent): void {
  const nodes = [...(resultsBox?.querySelectorAll<HTMLElement>(".search-result") ?? [])];
  if (!nodes.length) return;
  const index = nodes.indexOf(document.activeElement as HTMLElement);
  if (index === -1) return;
  if (event.key === "ArrowUp" && index === 0) {
    event.preventDefault();
    panelInput?.focus();
    return;
  }
  const next = nextFocusIndex(nodes, event, { wrap: false });
  if (next === -1) return;
  event.preventDefault();
  nodes[next]?.focus();
}

/** Ссылка на раздел хаба из «ничего не найдено»: от текущей страницы к ./#wiki-cat-id. */
function hubHref(sectionId: string): string {
  const fallback = `${import.meta.env.BASE_URL}${lang === "en" ? "en/" : ""}wiki/`;
  if (typeof window === "undefined") return `${fallback}#wiki-cat-${sectionId}`;
  const segments = stripBase(window.location.pathname)
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);
  if (lang === "en" && segments[0] === "en") segments.shift();
  const wikiIndex = segments.indexOf("wiki");
  if (wikiIndex === -1) return `${fallback}#wiki-cat-${sectionId}`;
  const depth = segments.length - wikiIndex - 1;
  return `${depth > 0 ? "../".repeat(depth) : ""}#wiki-cat-${sectionId}`;
}

onMount(() => {
  recents = readRecent();
});

onDestroy(() => {
  destroyed = true;
});

/* Делегированные триггеры: кнопки/поля страниц, сайдбар и Ctrl/Cmd+K. */
$effect(() => {
  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>("[data-search-open], #searchInput");
    if (!trigger) return;
    event.preventDefault();
    openDialog(trigger instanceof HTMLInputElement ? trigger.value : "");
  };

  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.id === "searchInput" && event.key === "Enter") {
      event.preventDefault();
      openDialog(target instanceof HTMLInputElement ? target.value : "");
      return;
    }
    if (panel?.open) return;
    const isK = event.code === "KeyK" || (event.key || "").toLowerCase() === "k";
    if ((event.ctrlKey || event.metaKey) && isK) {
      event.preventDefault();
      openDialog();
    }
  };

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);
  return () => {
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onDocumentKeydown);
  };
});
</script>

<!-- biome-ignore lint/a11y/useKeyWithClickEvents: клик по фону закрывает диалог, Escape обрабатывает нативный dialog -->
<dialog
  class="search-panel"
  id="searchPanel"
  bind:this={panel}
  aria-label={labels.title}
  onclick={onPanelClick}
>
  <div class="search-panel__box">
    <!-- отдельного ключа для закрытия поиска в словаре нет — берём общий -->
    <button
      type="button"
      class="search-panel__close"
      aria-label={labels.close}
      onclick={closeDialog}
    >
      <X />
    </button>

    <search>
      <input
        class="search-panel__input"
        id="searchPanelInput"
        type="search"
        autocomplete="off"
        placeholder={labels.placeholder}
        aria-label={labels.title}
        bind:this={panelInput}
        bind:value={query}
        oninput={debouncedSearch}
        onkeydown={onInputKeydown}
      >
    </search>

    {#if !shortQuery && !failed}
      <fieldset class="search-filters" id="searchFilters">
        <button
          type="button"
          class="search-chip"
          class:is-active={!activeSection}
          onclick={() => selectSection("")}
        >
          {labels.all}
        </button>
        {#each filterSections as section (section.id)}
          <button
            type="button"
            class="search-chip"
            class:is-active={activeSection === section.id}
            onclick={() => selectSection(section.id)}
          >
            {section.title}
            · {counts[section.id]}
          </button>
        {/each}
      </fieldset>
    {/if}

    <p class="search-panel__hint" id="searchHint" role="status">{hintText}</p>

    <div
      class="search-results"
      class:is-loading={loading}
      id="searchResults"
      bind:this={resultsBox}
    >
      {#if failed}
        <div class="empty-block">{labels.loadError}</div>
      {:else if shortQuery}
        {#if recents.length}
          <div class="search-recent">
            <p class="search-recent__title">{labels.recent}</p>
            <div class="search-recent__row">
              {#each recents as recent (recent)}
                <button type="button" class="search-chip" onclick={() => useRecent(recent)}>
                  {recent}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {:else if !loading && !items.length}
        <div class="empty-block">{labels.empty}</div>
        <div class="search-sections">
          {#each sections as section (section.id)}
            <a href={hubHref(section.id)}>{section.title}</a>
          {/each}
        </div>
      {:else}
        {#each visible as item (item.href)}
          <a
            class="search-result"
            href={item.href}
            onclick={() => rememberQuery(query)}
            onkeydown={onResultsKeydown}
          >
            <span class="search-result__top">
              {#if item.sectionTitle}
                <span class="search-result__cat">{item.sectionTitle}</span>
              {/if}
              <b>{@html item.title}</b>
            </span>
            <p>{@html item.excerpt}</p>
          </a>
        {/each}
        {#if !expanded && hiddenCount > 0}
          <button type="button" class="search-more" onclick={() => (expanded = true)}>
            {fmt(labels.more, { n: hiddenCount })}
          </button>
        {/if}
      {/if}
    </div>
  </div>
</dialog>

<style>
.search-panel__box {
  position: relative;
}

/* fieldset вместо div[role=group]: гасим браузерные рамки и отступы */
.search-filters {
  border: 0;
  padding: 0;
  margin-inline: 0;
  min-inline-size: 0;
}

/* Кнопка закрытия — поверх правого края поля ввода. */
.search-panel__input {
  padding-right: 56px;
}

.search-panel__close {
  position: absolute;
  top: 10px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--muted);
  background: rgba(9, 19, 34, 0.8);
  border: 1px solid var(--line);
  border-radius: 999px;
  transition:
    color 0.18s,
    border-color 0.18s;
}

.search-panel__close:hover {
  color: #fff;
  border-color: var(--line-strong);
}

.search-panel__close:focus-visible {
  outline: 2px solid var(--cyan-hi);
  outline-offset: 2px;
}

.search-panel__close svg {
  width: 16px;
  height: 16px;
}

.search-results.is-loading {
  opacity: 0.55;
}
</style>
