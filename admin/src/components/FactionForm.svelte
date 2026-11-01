<script lang="ts">
  import { onMount } from "svelte";

  import type { ArticleSummary, Bootstrap, Faction, LocalizedText, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import { lines } from "../lib/format";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: Faction;
    bootstrap: Bootstrap;
    toast: ToastFn;
  }

  const { item, bootstrap, toast }: Props = $props();

  let articles = $state<ArticleSummary[]>([]);
  let isSub = $state(item.subfaction === true || typeof item.subfaction === "string");
  let parent = $state(typeof item.subfaction === "string" ? item.subfaction : "");
  let strengthsRu = $state(item.strengths?.ru.join("\n") ?? "");
  let strengthsEn = $state(item.strengths?.en.join("\n") ?? "");
  let weaknessesRu = $state(item.weaknesses?.ru.join("\n") ?? "");
  let weaknessesEn = $state(item.weaknesses?.en.join("\n") ?? "");
  let optional = $state({
    motto: { ru: item.motto?.ru ?? "", en: item.motto?.en ?? "" },
    playstyle: { ru: item.playstyle?.ru ?? "", en: item.playstyle?.en ?? "" },
    specialty: { ru: item.specialty?.ru ?? "", en: item.specialty?.en ?? "" },
  });

  const parentOptions = $derived(bootstrap.factions.filter((faction) => faction.id !== item.id));

  function updateSub(): void {
    item.subfaction = isSub ? (parent || true) : undefined;
  }

  function updateLists(): void {
    item.strengths =
      strengthsRu.trim() || strengthsEn.trim()
        ? { ru: lines(strengthsRu), en: lines(strengthsEn) }
        : undefined;
    item.weaknesses =
      weaknessesRu.trim() || weaknessesEn.trim()
        ? { ru: lines(weaknessesRu), en: lines(weaknessesEn) }
        : undefined;
  }

  function updateOptional(key: "motto" | "playstyle" | "specialty", text: LocalizedText): void {
    optional[key] = text;
    item[key] = text.ru.trim() || text.en.trim() ? text : undefined;
  }

  onMount(() => {
    void api
      .get<{ items: ArticleSummary[] }>("/api/articles")
      .then((response) => (articles = response.items))
      .catch(() => undefined);
  });
</script>

<div class="form-section">
  <div class="form-section__title">Идентификация <span>id и порядок</span></div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="faction-id">ID</label>
      <input
        id="faction-id"
        value={item.id}
        spellcheck="false"
        placeholder="fenearth"
        oninput={(event) => (item.id = event.currentTarget.value)}
      />
      <span class="field__hint">Меняется вместе с именем SVG-эмблемы.</span>
    </div>
    <div class="field">
      <label for="faction-order">Порядок</label>
      <input
        id="faction-order"
        type="number"
        min="1"
        value={item.order}
        oninput={(event) => (item.order = Number(event.currentTarget.value))}
      />
    </div>
    <div class="field">
      <label for="faction-color">Цвет</label>
      <div class="input-group">
        <input
          id="faction-color"
          type="color"
          value={item.color}
          oninput={(event) => (item.color = event.currentTarget.value)}
        />
        <input
          class="input"
          value={item.color}
          spellcheck="false"
          oninput={(event) => (item.color = event.currentTarget.value)}
        />
      </div>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Название и описание</div>
  <LocalizedInput label="Название" value={item.name} placeholder="Фенземская Республика" />
  <LocalizedInput label="Описание" value={item.desc} multiline rows={3} placeholder="Короткое описание фракции" />
</div>

<div class="form-section">
  <div class="form-section__title">Эмблема и лор</div>
  <div class="form-grid">
    <div class="field">
      <ImagePicker
        kind="faction"
        id={item.id}
        path={item.emblem}
        label="SVG-эмблема"
        {toast}
        onchange={(path) => (item.emblem = path)}
      />
    </div>
    <div class="field">
      <label for="faction-lore">Статья вики</label>
      <input
        id="faction-lore"
        value={item.lore}
        list="faction-lore-options"
        placeholder="factions/fenearth"
        oninput={(event) => (item.lore = event.currentTarget.value)}
      />
      <datalist id="faction-lore-options">
        {#each articles as article}
          <option value={article.slug}>{article.title.ru}</option>
        {/each}
      </datalist>
      <span class="field__hint">Slug статьи вида <code>factions/fenearth</code>.</span>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Дополнительно <span>необязательно</span></div>
  <div class="form-grid">
    <div class="field">
      <label for="faction-motto-ru">Девиз · RU</label>
      <input
        id="faction-motto-ru"
        value={optional.motto.ru}
        oninput={(event) => updateOptional("motto", { ...optional.motto, ru: event.currentTarget.value })}
      />
    </div>
    <div class="field">
      <label for="faction-motto-en">Девиз · EN</label>
      <input
        id="faction-motto-en"
        value={optional.motto.en}
        oninput={(event) => updateOptional("motto", { ...optional.motto, en: event.currentTarget.value })}
      />
    </div>
    <div class="field">
      <label for="faction-style-ru">Стиль игры · RU</label>
      <input
        id="faction-style-ru"
        value={optional.playstyle.ru}
        oninput={(event) => updateOptional("playstyle", { ...optional.playstyle, ru: event.currentTarget.value })}
      />
    </div>
    <div class="field">
      <label for="faction-style-en">Стиль игры · EN</label>
      <input
        id="faction-style-en"
        value={optional.playstyle.en}
        oninput={(event) => updateOptional("playstyle", { ...optional.playstyle, en: event.currentTarget.value })}
      />
    </div>
    <div class="field">
      <label for="faction-specialty-ru">Особенность · RU</label>
      <input
        id="faction-specialty-ru"
        value={optional.specialty.ru}
        oninput={(event) => updateOptional("specialty", { ...optional.specialty, ru: event.currentTarget.value })}
      />
    </div>
    <div class="field">
      <label for="faction-specialty-en">Особенность · EN</label>
      <input
        id="faction-specialty-en"
        value={optional.specialty.en}
        oninput={(event) => updateOptional("specialty", { ...optional.specialty, en: event.currentTarget.value })}
      />
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Сильные и слабые стороны <span>по одной строке</span></div>
  <div class="form-grid">
    <div class="field">
      <label for="faction-strong-ru">Сильные · RU</label>
      <textarea id="faction-strong-ru" rows="4" bind:value={strengthsRu} oninput={updateLists}></textarea>
    </div>
    <div class="field">
      <label for="faction-strong-en">Сильные · EN</label>
      <textarea id="faction-strong-en" rows="4" bind:value={strengthsEn} oninput={updateLists}></textarea>
    </div>
    <div class="field">
      <label for="faction-weak-ru">Слабые · RU</label>
      <textarea id="faction-weak-ru" rows="4" bind:value={weaknessesRu} oninput={updateLists}></textarea>
    </div>
    <div class="field">
      <label for="faction-weak-en">Слабые · EN</label>
      <textarea id="faction-weak-en" rows="4" bind:value={weaknessesEn} oninput={updateLists}></textarea>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Подфракция</div>
  <label class="tag-option" style="padding: 4px 0">
    <input
      type="checkbox"
      checked={isSub}
      onchange={(event) => {
        isSub = event.currentTarget.checked;
        updateSub();
      }}
    />
    <span>Это подфракция</span>
  </label>
  {#if isSub}
    <div class="field" style="margin-top: 8px; max-width: 360px">
      <label for="faction-parent">Родительская фракция</label>
      <select
        id="faction-parent"
        value={parent}
        onchange={(event) => {
          parent = event.currentTarget.value;
          updateSub();
        }}
      >
        <option value="">Не указана (true)</option>
        {#each parentOptions as faction}
          <option value={faction.id}>{faction.name.ru} · {faction.id}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>
