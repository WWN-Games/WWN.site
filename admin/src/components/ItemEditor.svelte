<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import type {
    AskConfirm,
    Bootstrap,
    Card,
    CollectionItem,
    Faction,
    Section,
    Tag,
    ToastFn,
    ValidationState,
  } from "../../shared/types";
  import { api, ApiError } from "../lib/api";
  import { dirty as dirtyStore } from "../lib/dirty";
  import Icon from "./Icon.svelte";
  import CardForm from "./CardForm.svelte";
  import FactionForm from "./FactionForm.svelte";
  import SectionForm from "./SectionForm.svelte";
  import TagForm from "./TagForm.svelte";

  interface Props {
    name: string;
    id?: string;
    bootstrap: Bootstrap;
    navigate: (path: string) => void;
    refresh: () => void;
    toast: ToastFn;
    askConfirm: AskConfirm;
  }

  const { name, id, bootstrap, navigate, refresh, toast, askConfirm }: Props = $props();

  const labels: Record<string, { title: string; singular: string }> = {
    units: { title: "Юнит", singular: "юнит" },
    buildings: { title: "Строение", singular: "строение" },
    factions: { title: "Фракция", singular: "фракция" },
    tags: { title: "Тег", singular: "тег" },
    sections: { title: "Раздел", singular: "раздел" },
  };
  const info = $derived(labels[name] ?? labels.units!);
  const isCards = $derived(name === "units" || name === "buildings");
  const isNew = $derived(!id);

  let item = $state<CollectionItem | null>(null);
  let originalId = $state<string | undefined>(undefined);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state("");
  let details = $state<string[]>([]);
  let initialSnapshot = $state("");

  const isDirty = $derived(item ? JSON.stringify(item) !== initialSnapshot : false);

  $effect(() => {
    dirtyStore.set(isDirty);
    return () => dirtyStore.set(false);
  });

  function createNew(): CollectionItem {
    const faction = bootstrap.factions[0]?.id ?? "";
    if (name === "units" || name === "buildings") {
      return {
        id: "",
        name: { ru: "", en: "" },
        faction,
        type: name === "units" ? "ground" : "economy",
        desc: { ru: "", en: "" },
        tags: [],
        cost: 0,
        hp: 0,
        buildTime: 0,
        image: "",
        draft: false,
        new: true,
      };
    }
    if (name === "factions") {
      return {
        id: "",
        order: Math.max(0, ...bootstrap.factions.map((entry) => entry.order)) + 1,
        name: { ru: "", en: "" },
        color: "#29b8ff",
        emblem: "",
        lore: "",
        desc: { ru: "", en: "" },
      };
    }
    if (name === "tags") {
      return { id: "", name: { ru: "", en: "" }, group: "tier" };
    }
    return {
      id: "",
      icon: "book",
      order: Math.max(0, ...bootstrap.sections.map((entry) => entry.order)) + 1,
      title: { ru: "", en: "" },
      desc: { ru: "", en: "" },
    };
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      const response = await api.get<{ items: CollectionItem[] }>(`/api/collections/${name}`);
      if (id) {
        const found = response.items.find((entry) => entry.id === id);
        if (!found) throw new Error(`Запись «${id}» не найдена`);
        item = structuredClone(found);
        originalId = id;
      } else {
        item = createNew();
        originalId = undefined;
      }
      initialSnapshot = JSON.stringify(item);
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  async function save(): Promise<void> {
    if (!item || saving) return;
    error = "";
    details = [];
    saving = true;
    try {
      const result = await api.post<{ item: CollectionItem; validation: ValidationState }>(
        `/api/collections/${name}`,
        { item, originalId },
      );
      const changedPath = result.item.id !== id;
      item = result.item;
      originalId = result.item.id;
      initialSnapshot = JSON.stringify(result.item);
      dirtyStore.set(false);
      toast("Запись сохранена");
      if (!result.validation.ok) {
        toast(`Сохранено, но валидация нашла ${result.validation.errors.length} ошибок`, "warn");
      }
      refresh();
      if (changedPath) navigate(`/collections/${name}/${result.item.id}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        error = cause.message;
        details = cause.details;
      } else {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      toast(error, "error");
    } finally {
      saving = false;
    }
  }

  async function remove(): Promise<void> {
    if (!originalId) return;
    const ok = await askConfirm({
      title: `Удалить ${info.singular}?`,
      message: `Запись «${originalId}» будет удалена. Это действие нельзя отменить без Git.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/collections/${name}/${encodeURIComponent(originalId)}`);
      dirtyStore.set(false);
      toast("Запись удалена");
      refresh();
      navigate(`/collections/${name}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  onMount(() => {
    void load();
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  onDestroy(() => {
    dirtyStore.set(false);
  });
</script>

{#if loading}
  <div class="loading"><span class="spinner"></span>Читаю запись…</div>
{:else if !item}
  <div class="empty">
    <div class="empty__icon"><Icon name="warning" size={24} /></div>
    <h2>Не удалось открыть запись</h2>
    <p>{error}</p>
    <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate(`/collections/${name}`)}>
      Назад
    </button>
  </div>
{:else}
  <div class="editor-head">
    <button class="icon-btn" type="button" title="К списку" onclick={() => navigate(`/collections/${name}`)}>
      <Icon name="arrowLeft" size={17} />
    </button>
    <div class="editor-title">
      <div class="eyebrow">{isNew ? `Новый ${info.singular}` : `Редактирование · ${info.singular}`}</div>
      <h1>
        {item.id || "Без названия"}
        {#if item.id}
          <span class="badge" style="vertical-align: middle">{name}</span>
        {/if}
      </h1>
    </div>
    <div class="editor-head__actions">
      <span class="badge" class:badge--warn={isDirty} class:badge--ok={!isDirty}>
        {isDirty ? "не сохранено" : "сохранено"}
      </span>
      <button class="btn btn--cyan btn--small" type="button" disabled={saving} onclick={save}>
        <Icon name="save" size={15} />
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-box" style="margin-bottom: 14px">
      <strong>{error}</strong>
      {#if details.length > 0}
        <ul>
          {#each details as detail}<li>{detail}</li>{/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="editor-layout">
    <section class="panel" style="min-width: 0">
      {#if isCards}
        {@const card = item as Card}
        <CardForm name={name as "units" | "buildings"} item={card} {bootstrap} {toast} />
      {:else if name === "factions"}
        {@const faction = item as Faction}
        <FactionForm item={faction} {bootstrap} {toast} />
      {:else if name === "tags"}
        {@const tag = item as Tag}
        <TagForm item={tag} />
      {:else}
        {@const section = item as Section}
        <SectionForm item={section} />
      {/if}
    </section>

    <aside class="editor-aside">
      <section class="panel aside-card">
        <h3>Запись</h3>
        <div class="aside-list">
          <div class="aside-row"><span>Коллекция</span><b>{name}.json</b></div>
          <div class="aside-row"><span>ID</span><b>{item.id || "—"}</b></div>
          <div class="aside-row"><span>Тип</span><b>{isNew ? "новая" : "существующая"}</b></div>
        </div>
        <p class="aside-note" style="margin-top: 10px">
          <code>src/data/{name}.json</code>
        </p>
      </section>

      <section class="panel aside-card">
        <h3>Действия</h3>
        <div class="aside-actions">
          <a class="btn btn--ghost btn--small" href={`#/collections/${name}`}>
            <Icon name="arrowLeft" size={14} /> К списку
          </a>
          <button class="btn btn--danger btn--small" type="button" onclick={remove} disabled={!originalId}>
            <Icon name="trash" size={14} /> Удалить
          </button>
        </div>
        {#if isDirty}
          <p class="aside-note" style="margin-top: 10px; color: var(--gold)">
            <code>Ctrl+S</code> — сохранить.
          </p>
        {/if}
      </section>
    </aside>
  </div>
{/if}
