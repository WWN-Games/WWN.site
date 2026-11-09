<script lang="ts">
  import type { Tag } from "../../shared/types";
  import Icon from "./Icon.svelte";

  interface Props {
    selected: string[];
    available: Tag[];
    groups?: readonly Tag["group"][];
    onchange: (ids: string[]) => void;
  }

  const {
    selected,
    available,
    groups = ["tier", "class", "movement", "mod"],
    onchange,
  }: Props = $props();

  let search = $state("");

  const groupDefs = [
    { id: "tier", label: "Тир" },
    { id: "class", label: "Класс" },
    { id: "movement", label: "Движение" },
    { id: "mod", label: "Мод" },
    { id: "weapon", label: "Оружие" },
    { id: "sector", label: "Сектор" },
  ] as const;

  const byId = $derived(new Map(available.map((tag) => [tag.id, tag])));
  const query = $derived(search.trim().toLowerCase());
  const filtered = $derived(
    query
      ? available.filter((tag) =>
          `${tag.id} ${tag.name.ru} ${tag.name.en}`.toLowerCase().includes(query),
        )
      : available,
  );

  function toggle(id: string): void {
    onchange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }
</script>

<div class="tag-picker">
  <div class="tag-picker__selected">
    {#each selected as id (id)}
      <span class="tag-chip">
        {byId.get(id)?.name.ru ?? id}
        <button type="button" aria-label={`Убрать ${id}`} onclick={() => toggle(id)}>
          <Icon name="close" size={10} />
        </button>
      </span>
    {/each}
  </div>
  <input
    class="input"
    type="search"
    bind:value={search}
    placeholder="Найти тег…"
    aria-label="Поиск тега"
  />
  <div class="tag-picker__panel">
    {#each groupDefs.filter((group) => groups.includes(group.id)) as group}
      {@const tags = filtered.filter((tag) => tag.group === group.id)}
      {#if tags.length > 0}
        <div class="tag-group">
          <div class="tag-group__label">{group.label}</div>
          {#each tags as tag (tag.id)}
            <label class="tag-option">
              <input
                type="checkbox"
                checked={selected.includes(tag.id)}
                onchange={() => toggle(tag.id)}
              />
              <span>{tag.name.ru}</span>
              <span class="badge" style="margin-left: auto">{tag.id}</span>
            </label>
          {/each}
        </div>
      {/if}
    {/each}
    {#if filtered.length === 0}
      <p class="aside-note">Теги не найдены.</p>
    {/if}
  </div>
</div>
