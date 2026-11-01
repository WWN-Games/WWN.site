<script lang="ts">
  import { onMount } from "svelte";

  import type { ArticleSummary, Bootstrap, Faction, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import { lines } from "../lib/format";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";

  interface Props {
    item: Faction;
    bootstrap: Bootstrap;
    toast: ToastFn;
  }

  const { item = $bindable(), bootstrap, toast }: Props = $props();

  let articles = $state<ArticleSummary[]>([]);

  const isSub = $derived(item.subfaction === true || typeof item.subfaction === "string");
  const parent = $derived(typeof item.subfaction === "string" ? item.subfaction : "");
  const strengthsRu = $derived(item.strengths?.ru.join("\n") ?? "");
  const strengthsEn = $derived(item.strengths?.en.join("\n") ?? "");
  const weaknessesRu = $derived(item.weaknesses?.ru.join("\n") ?? "");
  const weaknessesEn = $derived(item.weaknesses?.en.join("\n") ?? "");
  const mottoRu = $derived(item.motto?.ru ?? "");
  const mottoEn = $derived(item.motto?.en ?? "");
  const playstyleRu = $derived(item.playstyle?.ru ?? "");
  const playstyleEn = $derived(item.playstyle?.en ?? "");
  const specialtyRu = $derived(item.specialty?.ru ?? "");
  const specialtyEn = $derived(item.specialty?.en ?? "");

  const parentOptions = $derived(bootstrap.factions.filter((faction) => faction.id !== item.id));

  function setSub(enabled: boolean, parentId: string): void {
    item.subfaction = enabled ? (parentId || true) : undefined;
  }

  function setList(kind: "strengths" | "weaknesses", lang: "ru" | "en", value: string): void {
    const current = item[kind] ?? { ru: [], en: [] };
    const next = { ...current, [lang]: lines(value) };
    item[kind] = next.ru.length || next.en.length ? next : undefined;
  }

  function setOptional(
    key: "motto" | "playstyle" | "specialty",
    lang: "ru" | "en",
    value: string,
  ): void {
    const current = item[key] ?? { ru: "", en: "" };
    const next = { ...current, [lang]: value };
    item[key] = next.ru.trim() || next.en.trim() ? next : undefined;
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
        value={mottoRu}
        oninput={(event) => setOptional("motto", "ru", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="faction-motto-en">Девиз · EN</label>
      <input
        id="faction-motto-en"
        value={mottoEn}
        oninput={(event) => setOptional("motto", "en", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="faction-style-ru">Стиль игры · RU</label>
      <input
        id="faction-style-ru"
        value={playstyleRu}
        oninput={(event) => setOptional("playstyle", "ru", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="faction-style-en">Стиль игры · EN</label>
      <input
        id="faction-style-en"
        value={playstyleEn}
        oninput={(event) => setOptional("playstyle", "en", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="faction-specialty-ru">Особенность · RU</label>
      <input
        id="faction-specialty-ru"
        value={specialtyRu}
        oninput={(event) => setOptional("specialty", "ru", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="faction-specialty-en">Особенность · EN</label>
      <input
        id="faction-specialty-en"
        value={specialtyEn}
        oninput={(event) => setOptional("specialty", "en", event.currentTarget.value)}
      />
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Сильные и слабые стороны <span>по одной строке</span></div>
  <div class="form-grid">
    <div class="field">
      <label for="faction-strong-ru">Сильные · RU</label>
      <textarea id="faction-strong-ru" rows="4" value={strengthsRu} oninput={(event) => setList("strengths", "ru", event.currentTarget.value)}></textarea>
    </div>
    <div class="field">
      <label for="faction-strong-en">Сильные · EN</label>
      <textarea id="faction-strong-en" rows="4" value={strengthsEn} oninput={(event) => setList("strengths", "en", event.currentTarget.value)}></textarea>
    </div>
    <div class="field">
      <label for="faction-weak-ru">Слабые · RU</label>
      <textarea id="faction-weak-ru" rows="4" value={weaknessesRu} oninput={(event) => setList("weaknesses", "ru", event.currentTarget.value)}></textarea>
    </div>
    <div class="field">
      <label for="faction-weak-en">Слабые · EN</label>
      <textarea id="faction-weak-en" rows="4" value={weaknessesEn} oninput={(event) => setList("weaknesses", "en", event.currentTarget.value)}></textarea>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Подфракция</div>
  <label class="tag-option" style="padding: 4px 0">
    <input
      type="checkbox"
      checked={isSub}
      onchange={(event) => setSub(event.currentTarget.checked, parent)}
    />
    <span>Это подфракция</span>
  </label>
  {#if isSub}
    <div class="field" style="margin-top: 8px; max-width: 360px">
      <label for="faction-parent">Родительская фракция</label>
      <select
        id="faction-parent"
        value={parent}
        onchange={(event) => setSub(true, event.currentTarget.value)}
      >
        <option value="">Не указана (true)</option>
        {#each parentOptions as faction}
          <option value={faction.id}>{faction.name.ru} · {faction.id}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>
