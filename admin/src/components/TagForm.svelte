<script lang="ts">
  import type { Tag } from "../../shared/types";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: Tag;
  }

  const { item = $bindable() }: Props = $props();

  const groups = [
    { value: "tier", label: "Тир" },
    { value: "class", label: "Класс" },
    { value: "movement", label: "Движение" },
    { value: "mod", label: "Мод" },
  ];
</script>

<div class="form-section">
  <div class="form-section__title">Тег</div>
  <div class="form-grid">
    <div class="field">
      <label for="tag-id">ID</label>
      <input
        id="tag-id"
        value={item.id}
        spellcheck="false"
        placeholder="T1"
        oninput={(event) => (item.id = event.currentTarget.value)}
      />
      <span class="field__hint">Это значение вписывается в <code>tags</code> карточек.</span>
    </div>
    <div class="field">
      <label for="tag-group">Группа</label>
      <select
        id="tag-group"
        value={item.group}
        onchange={(event) => (item.group = event.currentTarget.value as Tag["group"])}
      >
        {#each groups as group}
          <option value={group.value}>{group.label} · {group.value}</option>
        {/each}
      </select>
    </div>
  </div>
  <LocalizedInput label="Название" value={item.name} placeholder="Тир 1" />
</div>
