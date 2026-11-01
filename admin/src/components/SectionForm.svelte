<script lang="ts">
  import type { Section } from "../../shared/types";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: Section;
  }

  const { item = $bindable() }: Props = $props();

  const icons = [
    { value: "book", label: "Книга" },
    { value: "shield", label: "Щит" },
    { value: "cube", label: "Куб" },
    { value: "gear", label: "Шестерня" },
    { value: "compass", label: "Компас" },
    { value: "users", label: "Люди" },
    { value: "clock", label: "Часы" },
    { value: "rocket", label: "Ракета" },
    { value: "chat", label: "Чат" },
  ];
</script>

<div class="form-section">
  <div class="form-section__title">Раздел вики</div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="section-id">ID</label>
      <input
        id="section-id"
        value={item.id}
        spellcheck="false"
        placeholder="lore"
        oninput={(event) => (item.id = event.currentTarget.value)}
      />
      <span class="field__hint">Имя папки в <code>src/content/wiki/&lt;lang&gt;/</code>.</span>
    </div>
    <div class="field">
      <label for="section-order">Порядок</label>
      <input
        id="section-order"
        type="number"
        min="1"
        value={item.order}
        oninput={(event) => (item.order = Number(event.currentTarget.value))}
      />
    </div>
    <div class="field">
      <label for="section-icon">Иконка</label>
      <select
        id="section-icon"
        value={item.icon}
        onchange={(event) => (item.icon = event.currentTarget.value)}
      >
        {#each icons as icon}
          <option value={icon.value}>{icon.label} · {icon.value}</option>
        {/each}
      </select>
    </div>
  </div>
  <LocalizedInput label="Название" value={item.title} placeholder="Лор" />
  <LocalizedInput label="Описание" value={item.desc} multiline rows={3} placeholder="Короткое описание раздела" />
</div>
