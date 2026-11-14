<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { addMonthsIso, todayIso } from "../../shared/date";
  import type {
    Article,
    ArticleFile,
    AskConfirm,
    Bootstrap,
    Lang,
    ToastFn,
    ValidationState,
  } from "../../shared/types";
  import { ApiError, api } from "../lib/api";
  import { dirty as dirtyStore } from "../lib/dirty.svelte";
  import { formatDate, slugify } from "../lib/format";
  import Icon from "./Icon.svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";

  interface Props {
    slug?: string;
    newSection?: string;
    bootstrap: Bootstrap;
    navigate: (path: string) => void;
    refresh: () => void;
    toast: ToastFn;
    askConfirm: AskConfirm;
  }

  const { slug, newSection, bootstrap, navigate, refresh, toast, askConfirm }: Props = $props();

  const isNew = $derived(!slug);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state("");
  let details = $state<string[]>([]);
  let activeLang = $state<Lang>("ru");
  let section = $state("");
  let name = $state("");
  let order = $state(1);
  let updated = $state(todayIso());
  let draft = $state(true);
  let isNewBadge = $state(false);
  let newUntil = $state<string | undefined>(undefined);
  let ru = $state<ArticleFile>({ title: "", desc: "", body: "", file: "", exists: false });
  let en = $state<ArticleFile>({ title: "", desc: "", body: "", file: "", exists: false });
  let originalSlug = $state<string | undefined>(undefined);
  let initialSnapshot = $state("");
  let slugTouched = $state(false);
  let orderTouched = $state(false);

  const fullSlug = $derived(name ? `${section}/${name}` : "");
  const current = $derived(activeLang === "ru" ? ru : en);
  const sectionInfo = $derived(bootstrap.sections.find((item) => item.id === section));
  const siteUrl = $derived(
    fullSlug
      ? `${bootstrap.site.url}/${activeLang === "en" ? "en/wiki" : "wiki"}/${fullSlug}/`
      : bootstrap.site.url,
  );

  function snapshotValue(): string {
    return JSON.stringify({
      section,
      name,
      order,
      updated,
      draft,
      isNewBadge,
      newUntil,
      ru: { title: ru.title, desc: ru.desc, body: ru.body },
      en: { title: en.title, desc: en.desc, body: en.body },
    });
  }

  const isDirty = $derived(snapshotValue() !== initialSnapshot);

  $effect(() => {
    dirtyStore.value = isDirty;
    return () => dirtyStore.value = false;
  });

  $effect(() => {
    if (!isNew || slugTouched) return;
    const next = slugify(ru.title);
    if (next && next !== name) name = next;
  });

  function emptyFile(file = ""): ArticleFile {
    return { title: "", desc: "", body: "", file, exists: false };
  }

  function applyArticle(article: Article): void {
    section = article.section;
    name = article.slug.split("/").slice(1).join("/");
    order = article.order;
    updated = article.updated;
    draft = article.draft;
    isNewBadge = article.new;
    newUntil = article.newUntil;
    ru = { ...article.ru };
    en = { ...article.en };
    originalSlug = article.slug;
    slugTouched = true;
    orderTouched = true;
    initialSnapshot = snapshotValue();
  }

  function initNew(): void {
    const first = bootstrap.sections[0];
    section = newSection ?? first?.id ?? "misc";
    const info = bootstrap.sections.find((item) => item.id === section);
    order = info?.nextOrder ?? 1;
    updated = todayIso();
    draft = true;
    isNewBadge = false;
    newUntil = undefined;
    name = "";
    ru = emptyFile();
    en = emptyFile();
    originalSlug = undefined;
    slugTouched = false;
    orderTouched = false;
    initialSnapshot = snapshotValue();
    loading = false;
  }

  async function load(): Promise<void> {
    if (!slug) {
      initNew();
      return;
    }
    loading = true;
    try {
      const article = await api.get<Article>(`/api/article?slug=${encodeURIComponent(slug)}`);
      applyArticle(article);
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  function validate(): string[] {
    const issues: string[] = [];
    if (!bootstrap.sections.some((item) => item.id === section)) issues.push("Выберите раздел");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      issues.push("Slug статьи: только строчная латиница, цифры и дефис");
    }
    if (!Number.isInteger(order) || order <= 0) issues.push("Порядок должен быть целым числом больше нуля");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) issues.push("Дата должна быть в формате YYYY-MM-DD");
    if (isNewBadge && newUntil && !/^\d{4}-\d{2}-\d{2}$/.test(newUntil)) {
      issues.push("Дата окончания плашки должна быть в формате YYYY-MM-DD");
    }
    for (const [lang, file] of [["RU", ru], ["EN", en]] as const) {
      if (!file.title.trim()) issues.push(`Заголовок ${lang} не заполнен`);
      if (!file.desc.trim()) issues.push(`Описание ${lang} не заполнено`);
    }
    return issues;
  }

  async function save(): Promise<void> {
    if (saving) return;
    error = "";
    details = [];
    const issues = validate();
    if (issues.length > 0) {
      details = issues;
      toast("Проверьте обязательные поля", "warn");
      return;
    }
    saving = true;
    try {
      const result = await api.post<{ article: Article; validation: ValidationState }>("/api/article", {
        originalSlug,
        section,
        slug: fullSlug,
        order,
        updated,
        draft,
        new: isNewBadge,
        newUntil,
        ru: { title: ru.title, desc: ru.desc, body: ru.body },
        en: { title: en.title, desc: en.desc, body: en.body },
      });
      const changedPath = result.article.slug !== slug;
      applyArticle(result.article);
      dirtyStore.value = false;
      toast("Статья сохранена");
      if (!result.validation.ok) {
        toast(`Сохранено, но валидация нашла ${result.validation.errors.length} ошибок`, "warn");
      }
      refresh();
      if (changedPath) navigate(`/article/${result.article.slug}`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        error = cause.message;
        details = cause.details;
      } else {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      toast(error, "error");
    } finally {
      saving = false;
    }
  }

  async function remove(): Promise<void> {
    if (!originalSlug) return;
    const ok = await askConfirm({
      title: "Удалить статью?",
      message: `Будут удалены оба файла: ru и en для «${originalSlug}».`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/article?slug=${encodeURIComponent(originalSlug)}`);
      dirtyStore.value = false;
      toast("Статья удалена");
      refresh();
      navigate("/articles");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  async function duplicate(): Promise<void> {
    if (!originalSlug) {
      toast("Сначала сохраните статью", "warn");
      return;
    }
    try {
      const result = await api.post<{ article: Article }>("/api/article/duplicate", {
        slug: originalSlug,
      });
      dirtyStore.value = false;
      toast(`Создана копия: ${result.article.slug}`);
      refresh();
      navigate(`/article/${result.article.slug}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  function copyRuToEn(): void {
    en = { ...en, title: ru.title, desc: ru.desc, body: ru.body };
    toast("EN заполнен из RU — проверьте перевод");
  }

  function regenerateSlug(): void {
    const next = slugify(ru.title);
    if (next) {
      name = next;
      slugTouched = true;
    }
  }

  function onSectionChange(next: string): void {
    section = next;
    if (isNew && !orderTouched) {
      const info = bootstrap.sections.find((item) => item.id === next);
      order = info?.nextOrder ?? 1;
    }
  }

  function setTitle(value: string): void {
    if (activeLang === "ru") ru.title = value;
    else en.title = value;
  }

  function setDesc(value: string): void {
    if (activeLang === "ru") ru.desc = value;
    else en.desc = value;
  }

  onMount(() => {
    void load();
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  onDestroy(() => {
    dirtyStore.value = false;
  });
</script>

{#if loading}
  <div class="loading"><span class="spinner"></span>Читаю статью…</div>
{:else}
  <div class="editor-head">
    <button class="icon-btn" type="button" title="К списку статей" onclick={() => navigate("/articles")}>
      <Icon name="arrowLeft" size={17} />
    </button>
    <div class="editor-title">
      <div class="eyebrow">{isNew ? "Новая статья" : "Редактирование"}</div>
      <input
        class="input"
        value={activeLang === "ru" ? ru.title : en.title}
        placeholder="Заголовок статьи"
        oninput={(event) => setTitle(event.currentTarget.value)}
      />
    </div>
    <div class="editor-head__actions">
      <span class="badge" class:badge--warn={isDirty} class:badge--ok={!isDirty}>
        {isDirty ? "не сохранено" : "сохранено"}
      </span>
      <button class="btn btn--cyan btn--small" type="button" disabled={saving} onclick={save}>
        <Icon name="save" size={15} />
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-box" style="margin-bottom: 14px">
      <strong>{error}</strong>
      {#if details.length > 0}
        <ul>
          {#each details as detail}
            <li>{detail}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="editor-layout">
    <section class="panel" style="min-width: 0">
      <div class="article-meta">
        <div class="field">
          <label for="article-section">Раздел</label>
          <select
            id="article-section"
            value={section}
            onchange={(event) => onSectionChange(event.currentTarget.value)}
          >
            {#each bootstrap.sections as item}
              <option value={item.id}>{item.title.ru} · {item.id}</option>
            {/each}
          </select>
          <span class="field__hint">Смена раздела переносит файлы статьи и меняет URL.</span>
        </div>

        <div class="field">
          <label for="article-slug">Slug</label>
          <div class="slug-row">
            <span class="slug-prefix">{section}/</span>
            <input
              id="article-slug"
              class="input"
              value={name}
              spellcheck="false"
              oninput={(event) => {
                name = event.currentTarget.value;
                slugTouched = true;
              }}
            />
            <button class="icon-btn" type="button" title="Сгенерировать из заголовка" onclick={regenerateSlug}>
              <Icon name="refresh" size={14} />
            </button>
          </div>
          <span class="slug-preview">/wiki/{fullSlug || "…"}/</span>
        </div>

        <div class="field">
          <label for="article-order">Порядок</label>
          <input
            id="article-order"
            type="number"
            min="1"
            value={order}
            oninput={(event) => {
              order = Number(event.currentTarget.value);
              orderTouched = true;
            }}
          />
        </div>

        <div class="field">
          <label for="article-updated">Обновлено</label>
          <input
            id="article-updated"
            type="date"
            value={updated}
            oninput={(event) => (updated = event.currentTarget.value)}
          />
        </div>

        <div class="field field--inline">
          <input
            id="article-draft"
            type="checkbox"
            checked={draft}
            onchange={(event) => (draft = event.currentTarget.checked)}
          />
          <label for="article-draft">Черновик</label>
        </div>

        <div class="field field--inline">
          <input
            id="article-new"
            type="checkbox"
            checked={isNewBadge}
            onchange={(event) => {
              isNewBadge = event.currentTarget.checked;
              newUntil = isNewBadge
                ? (newUntil ?? addMonthsIso(todayIso(), 2))
                : undefined;
            }}
          />
          <label for="article-new">Новинка!</label>
        </div>

        {#if isNewBadge}
          <div class="field">
            <label for="article-new-until">Плашка до</label>
            <input
              id="article-new-until"
              type="date"
              value={newUntil ?? ""}
              oninput={(event) => (newUntil = event.currentTarget.value || undefined)}
            />
          </div>
        {/if}
      </div>

      <div class="editor-tabs">
        <div class="tabs">
          <button class="tab" class:is-active={activeLang === "ru"} type="button" onclick={() => (activeLang = "ru")}>
            RU
            <span class="badge" class:badge--ok={ru.exists} class:badge--bad={!ru.exists}>
              {ru.exists ? "есть" : "нет"}
            </span>
          </button>
          <button class="tab" class:is-active={activeLang === "en"} type="button" onclick={() => (activeLang = "en")}>
            EN
            <span class="badge" class:badge--ok={en.exists} class:badge--bad={!en.exists}>
              {en.exists ? "есть" : "нет"}
            </span>
          </button>
        </div>
        <span class="toolbar__spacer"></span>
        <button class="btn btn--ghost btn--small" type="button" onclick={copyRuToEn}>
          Скопировать RU → EN
        </button>
      </div>

      <div class="editor-body" style="display: grid; gap: 14px">
        <div class="field">
          <label for="article-title">Заголовок · {activeLang.toUpperCase()}</label>
          <input
            id="article-title"
            value={current.title}
            placeholder="Название статьи"
            oninput={(event) => setTitle(event.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label for="article-desc">Описание · {activeLang.toUpperCase()}</label>
          <textarea
            id="article-desc"
            rows="2"
            value={current.desc}
            placeholder="Одна строка для меню, поиска и meta description"
            oninput={(event) => setDesc(event.currentTarget.value)}
          ></textarea>
        </div>

        {#if activeLang === "ru"}
          <MarkdownEditor bind:value={ru.body} lang="ru" {section} slug={fullSlug} {toast} />
        {:else}
          <MarkdownEditor bind:value={en.body} lang="en" {section} slug={fullSlug} {toast} />
        {/if}
      </div>
    </section>

    <aside class="editor-aside">
      <section class="panel aside-card">
        <h3>Файлы</h3>
        <div class="aside-list">
          <div class="aside-row">
            <span>RU</span>
            <b>{ru.exists ? "на месте" : "будет создан"}</b>
          </div>
          <div class="aside-row">
            <span>EN</span>
            <b>{en.exists ? "на месте" : "будет создан"}</b>
          </div>
          <div class="aside-row">
            <span>Раздел</span>
            <b>{sectionInfo?.title.ru ?? section}</b>
          </div>
          <div class="aside-row">
            <span>Дата</span>
            <b>{formatDate(updated)}</b>
          </div>
          <div class="aside-row">
            <span>Статус</span>
            <b>{draft ? "черновик" : "опубликована"}</b>
          </div>
        </div>
        {#if current.file}
          <p class="aside-note" style="margin-top: 10px">{current.file}</p>
        {/if}
      </section>

      <section class="panel aside-card">
        <h3>Действия</h3>
        <div class="aside-actions">
          <a class="btn btn--ghost btn--small" href={siteUrl} target="_blank" rel="noopener">
            <Icon name="external" size={14} /> Открыть на сайте
          </a>
          <button class="btn btn--ghost btn--small" type="button" onclick={duplicate}>
            <Icon name="copy" size={14} /> Дублировать
          </button>
          <button class="btn btn--danger btn--small" type="button" onclick={remove} disabled={!originalSlug}>
            <Icon name="trash" size={14} /> Удалить
          </button>
        </div>
        {#if !bootstrap.site.running}
          <p class="aside-note" style="margin-top: 10px">
            Сайт не запущен: <code>pnpm dev</code>
          </p>
        {/if}
      </section>
    </aside>
  </div>
{/if}
