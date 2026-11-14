<script lang="ts">
  import type { GalleryItemData, ToastFn } from "../../shared/types";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: GalleryItemData;
    toast: ToastFn;
  }

  const { item = $bindable(), toast }: Props = $props();
</script>

<div class="form-section">
  <div class="form-section__title">Скриншот</div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="gallery-id">ID</label>
      <input id="gallery-id" value={item.id} spellcheck="false" placeholder="space-battle" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="gallery-order">Порядок</label>
      <input id="gallery-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
    <div class="field">
      <label class="tag-option" style="padding: 30px 0 0">
        <input type="checkbox" checked={item.wide} onchange={(event) => (item.wide = event.currentTarget.checked)} />
        <span>Широкая плитка</span>
      </label>
    </div>
  </div>
  <LocalizedInput label="Подпись" value={item.caption} placeholder="Космический бой" />
</div>

<div class="form-section">
  <div class="form-section__title">Изображение</div>
  <ImagePicker kind="gallery" id={item.id} path={item.image} label="Файл скриншота" {toast} onchange={(path) => (item.image = path)} />
  <p class="field__hint" style="margin-top: 8px"><code>src/assets/img/gallery</code></p>
</div>
