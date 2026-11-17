<script lang="ts">
  import type { NewsItem } from "../../shared/types";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: NewsItem;
  }

  const { item = $bindable() }: Props = $props();

  const tags = [
    { value: "update", label: "Обновление" },
    { value: "news", label: "Новости" },
  ];

  function linkValue(): string {
    if (typeof item.link === "string") return item.link;
    return item.link?.ru ?? "";
  }
</script>

<div class="form-section">
  <div class="form-section__title">Новость</div>
  <div class="form-grid form-grid--four">
    <div class="field">
      <label for="news-id">ID</label>
      <input id="news-id" value={item.id} spellcheck="false" placeholder="wiki-launch" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="news-date">Дата</label>
      <input id="news-date" type="date" value={item.date} oninput={(event) => (item.date = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="news-tag">Тег</label>
      <select id="news-tag" value={item.tag} onchange={(event) => (item.tag = event.currentTarget.value as NewsItem["tag"])}>
        {#each tags as tag}
          <option value={tag.value}>{tag.label} · {tag.value}</option>
        {/each}
      </select>
    </div>
    <div class="field">
      <label for="news-order">Порядок</label>
      <input id="news-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
  </div>

  <LocalizedInput label="Заголовок" value={item.title} placeholder="Обновление WWN" />
  <LocalizedInput label="Текст" value={item.text} multiline rows={4} placeholder="Короткая новость" />

  <div class="field">
    <label for="news-link">Ссылка</label>
    <input
      id="news-link"
      value={linkValue()}
      placeholder="https://… или wiki/"
      oninput={(event) => (item.link = event.currentTarget.value.trim() || undefined)}
    />
    <span class="field__hint">Внешняя ссылка или путь от корня сайта. Одна для RU и EN.</span>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Показ</div>
  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={item.featured} onchange={(event) => (item.featured = event.currentTarget.checked)} />
    <span>Закрепить на главной</span>
  </label>
  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={item.draft} onchange={(event) => (item.draft = event.currentTarget.checked)} />
    <span>Черновик — скрыть с сайта</span>
  </label>
</div>
