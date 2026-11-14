<script lang="ts">
  import type { VideoItem } from "../../shared/types";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: VideoItem;
  }

  const { item = $bindable() }: Props = $props();

  $effect(() => {
    if (!item.desc) item.desc = { ru: "", en: "" };
  });
</script>

<div class="form-section">
  <div class="form-section__title">Видео</div>
  <div class="form-grid form-grid--four">
    <div class="field">
      <label for="video-id">ID</label>
      <input id="video-id" value={item.id} spellcheck="false" placeholder="review-2026" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="video-youtube">YouTube ID</label>
      <input id="video-youtube" value={item.youtubeId} spellcheck="false" placeholder="dQw4w9WgXcQ" oninput={(event) => (item.youtubeId = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="video-lang">Язык</label>
      <select id="video-lang" value={item.lang} onchange={(event) => (item.lang = event.currentTarget.value as "ru" | "en")}>
        <option value="ru">RU</option>
        <option value="en">EN</option>
      </select>
    </div>
    <div class="field">
      <label for="video-order">Порядок</label>
      <input id="video-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
    <div class="field">
      <label for="video-date">Дата</label>
      <input id="video-date" type="date" value={item.date ?? ""} oninput={(event) => (item.date = event.currentTarget.value || undefined)} />
    </div>
  </div>
  <LocalizedInput label="Название" value={item.title} placeholder="Обзор WWN" />
  <LocalizedInput label="Описание" value={item.desc ?? { ru: "", en: "" }} multiline rows={3} placeholder="Короткое описание" />
</div>
