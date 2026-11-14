<script lang="ts">
  import { addMonthsIso, todayIso } from "../../shared/date";
  import type { MapItem, ToastFn } from "../../shared/types";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: MapItem;
    toast: ToastFn;
  }

  const { item = $bindable(), toast }: Props = $props();

  function setText(
    key: "size" | "mode" | "author",
    lang: "ru" | "en",
    value: string,
  ): void {
    const current = item[key] ?? { ru: "", en: "" };
    const next = { ...current, [lang]: value };
    item[key] = next.ru.trim() || next.en.trim() ? next : undefined;
  }

  function toggleNew(checked: boolean): void {
    item.new = checked;
    item.newUntil = checked ? (item.newUntil ?? addMonthsIso(todayIso(), 2)) : undefined;
  }
</script>

<div class="form-section">
  <div class="form-section__title">Карта <span>id и порядок</span></div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="map-id">ID</label>
      <input id="map-id" value={item.id} spellcheck="false" placeholder="space-battle" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-order">Порядок</label>
      <input id="map-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
    <div class="field">
      <label for="map-players">Макс. игроков</label>
      <input id="map-players" type="number" min="1" value={item.players ?? ""} placeholder="—" oninput={(event) => (item.players = event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value))} />
    </div>
  </div>
  <LocalizedInput label="Название" value={item.name} placeholder="Космическая битва" />
  <LocalizedInput label="Описание" value={item.desc} multiline rows={3} placeholder="Описание карты" />
</div>

<div class="form-section">
  <div class="form-section__title">Подписи <span>необязательно</span></div>
  <div class="form-grid form-grid--two">
    <div class="field">
      <label for="map-size-ru">Размер · RU</label>
      <input id="map-size-ru" value={item.size?.ru ?? ""} placeholder="2048×2048" oninput={(event) => setText("size", "ru", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-size-en">Размер · EN</label>
      <input id="map-size-en" value={item.size?.en ?? ""} placeholder="2048×2048" oninput={(event) => setText("size", "en", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-mode-ru">Режим · RU</label>
      <input id="map-mode-ru" value={item.mode?.ru ?? ""} placeholder="1 на 1" oninput={(event) => setText("mode", "ru", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-mode-en">Режим · EN</label>
      <input id="map-mode-en" value={item.mode?.en ?? ""} placeholder="1v1" oninput={(event) => setText("mode", "en", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-author-ru">Автор · RU</label>
      <input id="map-author-ru" value={item.author?.ru ?? ""} oninput={(event) => setText("author", "ru", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="map-author-en">Автор · EN</label>
      <input id="map-author-en" value={item.author?.en ?? ""} oninput={(event) => setText("author", "en", event.currentTarget.value)} />
    </div>
  </div>
  <div class="field">
    <label for="map-download">Ссылка на скачивание</label>
    <input id="map-download" value={item.download ?? ""} placeholder="https://…" oninput={(event) => (item.download = event.currentTarget.value || undefined)} />
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Изображение</div>
  <ImagePicker kind="map" id={item.id} path={item.image} label="Скриншот карты" {toast} onchange={(path) => (item.image = path)} />
  <div class="field" style="margin-top: 12px">
    <label class="tag-option" style="padding: 6px 0">
      <input type="checkbox" checked={item.new ?? false} onchange={(event) => toggleNew(event.currentTarget.checked)} />
      <span>Новинка! — золотая плашка</span>
    </label>
    {#if item.new}
      <div class="field">
        <label for="map-new-until">Показывать до</label>
        <input id="map-new-until" type="date" value={item.newUntil ?? ""} oninput={(event) => (item.newUntil = event.currentTarget.value || undefined)} />
      </div>
    {/if}
  </div>
</div>
