<script lang="ts">
  import type { Card } from "../../shared/types";
  import Icon from "./Icon.svelte";

  interface Props {
    selected: string[];
    units: Card[];
    onchange: (ids: string[]) => void;
  }

  const { selected, units, onchange }: Props = $props();

  let search = $state("");
  const query = $derived(search.trim().toLowerCase());
  const filtered = $derived(
    query
      ? units.filter((unit) =>
          `${unit.id} ${unit.name.ru} ${unit.name.en}`.toLowerCase().includes(query),
        )
      : units,
  );

  function toggle(id: string): void {
    onchange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }
</script>

<div class="tag-picker">
  <div class="tag-picker__selected">
    {#each selected as id (id)}
      {@const unit = units.find((item) => item.id === id)}
      <span class="tag-chip">
        {unit?.name.ru ?? id}
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
    placeholder="Найти юнит…"
    aria-label="Поиск юнита"
  />
  <div class="tag-picker__panel">
    {#each filtered as unit (unit.id)}
      <label class="tag-option">
        <input
          type="checkbox"
          checked={selected.includes(unit.id)}
          onchange={() => toggle(unit.id)}
        />
        <span>{unit.name.ru}</span>
        <span class="badge" style="margin-left: auto">{unit.id}</span>
      </label>
    {/each}
    {#if filtered.length === 0}
      <p class="aside-note">Юниты не найдены.</p>
    {/if}
  </div>
</div>
