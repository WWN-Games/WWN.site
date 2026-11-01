<script lang="ts">
  import type { LocalizedText } from "../../shared/types";

  interface Props {
    label: string;
    value: LocalizedText;
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    hint?: string;
  }

  const {
    label,
    value,
    multiline = false,
    rows = 4,
    placeholder = "",
    hint = "",
  }: Props = $props();
</script>

<div class="form-grid span-all">
  <div class="field">
    <span class="field__label">{label} · RU</span>
    {#if multiline}
      <textarea
        rows={rows}
        {placeholder}
        value={value.ru}
        oninput={(event) => (value.ru = event.currentTarget.value)}
      ></textarea>
    {:else}
      <input
        type="text"
        {placeholder}
        value={value.ru}
        oninput={(event) => (value.ru = event.currentTarget.value)}
      />
    {/if}
  </div>
  <div class="field">
    <span class="field__label">{label} · EN</span>
    {#if multiline}
      <textarea
        rows={rows}
        {placeholder}
        value={value.en}
        oninput={(event) => (value.en = event.currentTarget.value)}
      ></textarea>
    {:else}
      <input
        type="text"
        {placeholder}
        value={value.en}
        oninput={(event) => (value.en = event.currentTarget.value)}
      />
    {/if}
  </div>
  {#if hint}
    <p class="field__hint span-all">{hint}</p>
  {/if}
</div>
