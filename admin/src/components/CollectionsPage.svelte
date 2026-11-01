<script lang="ts">
  import { onMount } from "svelte";

  import type {
    AskConfirm,
    Bootstrap,
    Card,
    CollectionItem,
    Faction,
    Section,
    Tag,
    ToastFn,
  } from "../../shared/types";
  import { api } from "../lib/api";
  import { assetUrl, formatCount } from "../lib/format";
  import CardThumb from "./CardThumb.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    name: string;
    bootstrap: Bootstrap;
    navigate: (path: string) => void;
    toast: ToastFn;
    askConfirm: AskConfirm;
    refresh: () => void;
  }

  const { name, bootstrap, navigate, toast, askConfirm, refresh }: Props = $props();

  const meta: Record<string, { title: string; singular: string; newLabel: string }> = {
    units: {
      title: "Юниты",
      singular: "юнит",
      newLabel: "Новый юнит",
    },
    buildings: {
      title: "Строения",
      singular: "строение",
      newLabel: "Новое строение",
    },
    factions: {
      title: "Фракции",
      singular: "фракция",
      newLabel: "Новая фракция",
    },
    tags: {
      title: "Теги",
      singular: "тег",
      newLabel: "Новый тег",
    },
    sections: {
      title: "Разделы вики",
      singular: "раздел",
      newLabel: "Новый раздел",
    },
  };

  const info = $derived(meta[name] ?? meta.units!);
  const isCards = $derived(name === "units" || name === "buildings");

  let items = $state<CollectionItem[]>([]);
  let loading = $state(true);
  let error = $state("");
  let search = $state("");
  let factionFilter = $state("all");
  let typeFilter = $state("all");
  let statusFilter = $state("all");

  const factionById = $derived(new Map(bootstrap.factions.map((faction) => [faction.id, faction])));
  const tagById = $derived(new Map(bootstrap.tags.map((tag) => [tag.id, tag])));

  const typeOptions = $derived(
    name === "units"
      ? ["ground", "air", "naval", "space", "support"]
      : ["economy", "defense", "structure"],
  );

  const query = $derived(search.trim().toLowerCase().replace(/ё/g, "е"));

  function labelOf(item: CollectionItem): string {
    if ("name" in item) return item.name.ru || item.name.en || item.id;
    if ("title" in item) return item.title.ru || item.title.en || item.id;
    return item.id;
  }

  const filtered = $derived.by(() => {
    const list = items.filter((item) => {
      if (isCards) {
        const card = item as Card;
        if (factionFilter !== "all" && card.faction !== factionFilter) return false;
        if (typeFilter !== "all" && card.type !== typeFilter) return false;
        if (statusFilter === "draft" && !card.draft) return false;
        if (statusFilter === "new" && !card.new) return false;
        if (statusFilter === "published" && card.draft) return false;
        if (query) {
          const haystack = [
            card.id,
            card.name.ru,
            card.name.en,
            card.desc.ru,
            card.desc.en,
            factionById.get(card.faction)?.name.ru ?? "",
            ...card.tags.map((id) => tagById.get(id)?.name.ru ?? id),
          ]
            .join(" ")
            .toLowerCase()
            .replace(/ё/g, "е");
          if (!haystack.includes(query)) return false;
        }
        return true;
      }
      if (name === "tags") {
        const tag = item as Tag;
        if (query && !`${tag.id} ${tag.name.ru} ${tag.name.en}`.toLowerCase().includes(query)) return false;
        return true;
      }
      if (name === "factions") {
        const faction = item as Faction;
        if (query && !`${faction.id} ${faction.name.ru} ${faction.name.en} ${faction.lore}`.toLowerCase().includes(query)) return false;
        return true;
      }
      const section = item as Section;
      if (query && !`${section.id} ${section.title.ru} ${section.title.en}`.toLowerCase().includes(query)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (name === "factions") return (a as Faction).order - (b as Faction).order;
      if (name === "sections") return (a as Section).order - (b as Section).order;
      return labelOf(a).localeCompare(labelOf(b), "ru");
    });
  });

  async function load(): Promise<void> {
    loading = true;
    try {
      const response = await api.get<{ items: CollectionItem[] }>(`/api/collections/${name}`);
      items = response.items;
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  async function remove(item: CollectionItem): Promise<void> {
    const ok = await askConfirm({
      title: `Удалить ${info.singular}?`,
      message: `Запись «${labelOf(item)}» будет удалена из ${name}.json.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/collections/${name}/${encodeURIComponent(item.id)}`);
      toast(`Запись «${item.id}» удалена`);
      await load();
      refresh();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  function resetFilters(): void {
    search = "";
    factionFilter = "all";
    typeFilter = "all";
    statusFilter = "all";
  }

  onMount(() => {
    void load();
  });
</script>

<div class="page-head">
  <div>
    <div class="eyebrow">База данных</div>
    <h1>{info.title}</h1>
  </div>
  <div class="page-head__actions">
    <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/collections/${name}/new`)}>
      <Icon name="plus" size={15} />
      {info.newLabel}
    </button>
  </div>
</div>

{#if error}
  <div class="error-box" style="margin-bottom: 16px">{error}</div>
{/if}

<section class="panel">
  <div class="toolbar">
    <div class="search">
      <Icon name="search" size={15} />
      <input bind:value={search} type="search" placeholder="Поиск по id, названию, описанию…" />
    </div>

    {#if isCards}
      <div class="field">
        <select bind:value={factionFilter} aria-label="Фракция">
          <option value="all">Все фракции</option>
          {#each bootstrap.factions as faction}
            <option value={faction.id}>{faction.name.ru}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <select bind:value={typeFilter} aria-label="Тип">
          <option value="all">Все типы</option>
          {#each typeOptions as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <select bind:value={statusFilter} aria-label="Статус">
          <option value="all">Любой статус</option>
          <option value="published">Опубликованные</option>
          <option value="draft">Черновики</option>
          <option value="new">Новые</option>
        </select>
      </div>
    {/if}

    <span class="toolbar__spacer"></span>
    <span class="badge">{formatCount(filtered.length)} из {formatCount(items.length)}</span>
    {#if search || factionFilter !== "all" || typeFilter !== "all" || statusFilter !== "all"}
      <button class="btn btn--ghost btn--small" type="button" onclick={resetFilters}>Сбросить</button>
    {/if}
    <button class="icon-btn" type="button" title="Обновить" onclick={load}>
      <Icon name="refresh" size={16} />
    </button>
  </div>

  {#if loading}
    <div class="loading" style="min-height: 240px"><span class="spinner"></span>Читаю данные…</div>
  {:else if filtered.length === 0}
    <div class="empty">
      <div class="empty__icon"><Icon name={isCards ? "cube" : name === "factions" ? "shield" : name === "tags" ? "tag" : "layers"} size={24} /></div>
      <h2>{items.length === 0 ? "Здесь пока пусто" : "Ничего не найдено"}</h2>
      <p>{items.length === 0 ? `Создайте первый ${info.singular}.` : "Измените фильтры или поиск."}</p>
      <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/collections/${name}/new`)}>
        <Icon name="plus" size={15} /> {info.newLabel}
      </button>
    </div>
  {:else if isCards}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Название</th>
            <th>Фракция</th>
            <th>Тип</th>
            <th>Теги</th>
            <th>Статы</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as item (item.id)}
            {@const card = item as Card}
            <tr class="is-clickable" onclick={() => navigate(`/collections/${name}/${card.id}`)}>
              <td><CardThumb id={card.id} image={card.image} name={card.name.ru} /></td>
              <td>
                <div class="table__title">
                  <b>{card.name.ru}</b>
                  <small>{card.id}</small>
                </div>
              </td>
              <td>{factionById.get(card.faction)?.name.ru ?? card.faction}</td>
              <td><span class="badge">{card.type}</span></td>
              <td>
                {#each card.tags.slice(0, 3) as tag}
                  <span class="badge">{tagById.get(tag)?.name.ru ?? tag}</span>
                {/each}
                {#if card.tags.length > 3}<span class="badge">+{card.tags.length - 3}</span>{/if}
              </td>
              <td>
                <span class="badge">cost {card.cost}</span>
                <span class="badge">hp {card.hp}</span>
              </td>
              <td>
                {#if card.draft}<span class="badge badge--warn">черновик</span>{/if}
                {#if card.new}<span class="badge badge--cyan">новое</span>{/if}
                {#if !card.draft && !card.new}<span class="badge badge--ok">ок</span>{/if}
              </td>
              <td>
                <div class="table__actions">
                  <a class="icon-btn" href={`#/collections/${name}/${card.id}`} title="Редактировать" onclick={(event) => event.stopPropagation()}>
                    <Icon name="edit" size={15} />
                  </a>
                  <button class="icon-btn icon-btn--danger" type="button" title="Удалить" onclick={(event) => { event.stopPropagation(); remove(card); }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if name === "factions"}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Фракция</th>
            <th>Порядок</th>
            <th>Лор</th>
            <th>Подфракция</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as item (item.id)}
            {@const faction = item as Faction}
            <tr class="is-clickable" onclick={() => navigate(`/collections/factions/${faction.id}`)}>
              <td>
                {#if faction.emblem}
                  <img class="table__thumb" src={assetUrl(faction.emblem)} alt="" loading="lazy" />
                {:else}
                  <span class="thumb-fallback">{(faction.name.ru || faction.id).slice(0, 2)}</span>
                {/if}
              </td>
              <td>
                <div class="table__title">
                  <b><span style={`color:${faction.color}`}>●</span> {faction.name.ru}</b>
                  <small>{faction.id}</small>
                </div>
              </td>
              <td>{faction.order}</td>
              <td><span class="badge">{faction.lore}</span></td>
              <td>{faction.subfaction ? "да" : "—"}</td>
              <td>
                <div class="table__actions">
                  <a class="icon-btn" href={`#/collections/factions/${faction.id}`} title="Редактировать" onclick={(event) => event.stopPropagation()}>
                    <Icon name="edit" size={15} />
                  </a>
                  <button class="icon-btn icon-btn--danger" type="button" title="Удалить" onclick={(event) => { event.stopPropagation(); remove(faction); }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if name === "tags"}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Тег</th>
            <th>ID</th>
            <th>Группа</th>
            <th>Использований</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as item (item.id)}
            {@const tag = item as Tag}
            <tr class="is-clickable" onclick={() => navigate(`/collections/tags/${tag.id}`)}>
              <td><b>{tag.name.ru}</b> <span class="badge">{tag.name.en}</span></td>
              <td><code>{tag.id}</code></td>
              <td><span class="badge">{tag.group}</span></td>
              <td>—</td>
              <td>
                <div class="table__actions">
                  <a class="icon-btn" href={`#/collections/tags/${tag.id}`} title="Редактировать" onclick={(event) => event.stopPropagation()}>
                    <Icon name="edit" size={15} />
                  </a>
                  <button class="icon-btn icon-btn--danger" type="button" title="Удалить" onclick={(event) => { event.stopPropagation(); remove(tag); }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Раздел</th>
            <th>ID</th>
            <th>Иконка</th>
            <th>Порядок</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as item (item.id)}
            {@const section = item as Section}
            <tr class="is-clickable" onclick={() => navigate(`/collections/sections/${section.id}`)}>
              <td>
                <div class="table__title">
                  <b>{section.title.ru}</b>
                  <small>{section.desc.ru}</small>
                </div>
              </td>
              <td><code>{section.id}</code></td>
              <td><span class="badge">{section.icon}</span></td>
              <td>{section.order}</td>
              <td>
                <div class="table__actions">
                  <a class="icon-btn" href={`#/collections/sections/${section.id}`} title="Редактировать" onclick={(event) => event.stopPropagation()}>
                    <Icon name="edit" size={15} />
                  </a>
                  <button class="icon-btn icon-btn--danger" type="button" title="Удалить" onclick={(event) => { event.stopPropagation(); remove(section); }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
