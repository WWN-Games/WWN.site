<script lang="ts">
  import { addMonthsIso, todayIso } from "../../shared/date";
  import type { FeatItem, ToastFn } from "../../shared/types";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: FeatItem;
    toast: ToastFn;
  }

  const { item = $bindable(), toast }: Props = $props();

  function toggleNew(checked: boolean): void {
    item.new = checked;
    item.newUntil = checked ? (item.newUntil ?? addMonthsIso(todayIso(), 2)) : undefined;
  }
</script>

<div class="form-section">
  <div class="form-section__title">Подвиг</div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="feat-id">ID</label>
      <input id="feat-id" value={item.id} spellcheck="false" placeholder="first-victory" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="feat-order">Порядок</label>
      <input id="feat-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
    <div class="field">
      <label for="feat-date">Дата</label>
      <input id="feat-date" type="date" value={item.date ?? ""} oninput={(event) => (item.date = event.currentTarget.value || undefined)} />
    </div>
  </div>
  <LocalizedInput label="Название" value={item.name} placeholder="Первая победа" />
  <LocalizedInput label="Информация" value={item.desc} multiline rows={4} placeholder="Что произошло" />
</div>

<div class="form-section">
  <div class="form-section__title">Изображение</div>
  <ImagePicker kind="feat" id={item.id} path={item.image} label="Картинка подвига" {toast} onchange={(path) => (item.image = path)} />
  <div class="field" style="margin-top: 12px">
    <label class="tag-option" style="padding: 6px 0">
      <input type="checkbox" checked={item.new ?? false} onchange={(event) => toggleNew(event.currentTarget.checked)} />
      <span>Новинка! — золотая плашка</span>
    </label>
    {#if item.new}
      <div class="field">
        <label for="feat-new-until">Показывать до</label>
        <input id="feat-new-until" type="date" value={item.newUntil ?? ""} oninput={(event) => (item.newUntil = event.currentTarget.value || undefined)} />
      </div>
    {/if}
  </div>
</div>
