<script lang="ts">
  import { onMount } from "svelte";

  import type { ArticleSummary, AskConfirm, Bootstrap, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import { formatDate } from "../lib/format";
  import Icon from "./Icon.svelte";

  interface Props {
    bootstrap: Bootstrap;
    navigate: (path: string) => void;
    toast: ToastFn;
    askConfirm: AskConfirm;
    refresh: () => void;
  }

  const { bootstrap, navigate, toast, askConfirm, refresh }: Props = $props();

  let articles = $state<ArticleSummary[]>([]);
  let loading = $state(true);
  let error = $state("");
  let search = $state("");
  let section = $state("all");
  let status = $state("all");

  const sectionOrder = $derived(new Map(bootstrap.sections.map((item) => [item.id, item.order])));
  const sectionTitle = $derived(new Map(bootstrap.sections.map((item) => [item.id, item.title.ru])));
  const newSection = $derived(section === "all" ? (bootstrap.sections[0]?.id ?? "misc") : section);

  const normalizedSearch = $derived(search.trim().toLowerCase().replace(/ё/g, "е"));

  const filtered = $derived(
    articles
      .filter((article) => {
        if (section !== "all" && article.section !== section) return false;
        if (status === "draft" && !article.draft) return false;
        if (status === "published" && article.draft) return false;
        if (status === "issues" && !article.error && article.hasRu && article.hasEn && !article.orderMismatch && !article.draftMismatch) return false;
        if (!normalizedSearch) return true;
        const haystack = [
          article.slug,
          article.title.ru,
          article.title.en,
          article.desc.ru,
          article.desc.en,
          sectionTitle.get(article.section) ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .replace(/ё/g, "е");
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const sectionA = sectionOrder.get(a.section) ?? 999;
        const sectionB = sectionOrder.get(b.section) ?? 999;
        return sectionA - sectionB || a.order - b.order || a.title.ru.localeCompare(b.title.ru, "ru");
      }),
  );

  const issueCount = $derived(
    articles.filter(
      (article) =>
        article.error ||
        !article.hasRu ||
        !article.hasEn ||
        article.orderMismatch ||
        article.draftMismatch,
    ).length,
  );

  async function load(): Promise<void> {
    loading = true;
    try {
      const response = await api.get<{ items: ArticleSummary[] }>("/api/articles");
      articles = response.items;
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  async function duplicate(article: ArticleSummary): Promise<void> {
    try {
      const result = await api.post<{ article: { slug: string } }>("/api/article/duplicate", {
        slug: article.slug,
      });
      toast(`Создана копия: ${result.article.slug}`);
      await load();
      refresh();
      navigate(`/article/${result.article.slug}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  async function remove(article: ArticleSummary): Promise<void> {
    const ok = await askConfirm({
      title: "Удалить статью?",
      message: `Будут удалены файлы RU и EN для «${article.slug}». Картинки останутся.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/article?slug=${encodeURIComponent(article.slug)}`);
      toast(`Статья «${article.slug}» удалена`);
      await load();
      refresh();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    }
  }

  function siteUrl(article: ArticleSummary): string {
    const langPrefix = article.hasRu ? "" : "en/";
    return `${bootstrap.site.url}/${langPrefix}wiki/${article.slug}/`;
  }

  onMount(() => {
    void load();
  });
</script>

<div class="page-head">
  <div>
    <div class="eyebrow">Вики</div>
    <h1>Статьи</h1>
    <p>
      {articles.length} статей в {bootstrap.sections.length} разделах.
      {#if issueCount > 0}
        <span class="badge badge--warn">{issueCount} требуют внимания</span>
      {/if}
    </p>
  </div>
  <div class="page-head__actions">
    <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/articles/new?section=${newSection}`)}>
      <Icon name="plus" size={15} />
      Новая статья
    </button>
  </div>
</div>

{#if error}
  <div class="error-box" style="margin-bottom: 16px">{error}</div>
{/if}

<section class="panel">
  <div class="toolbar">
    <div class="search">
      <Icon name="search" size={15} />
      <input bind:value={search} type="search" placeholder="Поиск по заголовку, slug, описанию…" />
    </div>
    <div class="field">
      <select bind:value={section} aria-label="Раздел">
        <option value="all">Все разделы</option>
        {#each bootstrap.sections as item}
          <option value={item.id}>{item.title.ru}</option>
        {/each}
      </select>
    </div>
    <div class="field">
      <select bind:value={status} aria-label="Статус">
        <option value="all">Любой статус</option>
        <option value="published">Опубликованные</option>
        <option value="draft">Черновики</option>
        <option value="issues">С проблемами</option>
      </select>
    </div>
    <span class="toolbar__spacer"></span>
    <span class="badge">{filtered.length} из {articles.length}</span>
    <button class="icon-btn" type="button" title="Обновить список" onclick={load}>
      <Icon name="refresh" size={16} />
    </button>
  </div>

  {#if loading}
    <div class="loading" style="min-height: 240px"><span class="spinner"></span>Читаю статьи…</div>
  {:else if filtered.length === 0}
    <div class="empty">
      <div class="empty__icon"><Icon name="article" size={24} /></div>
      <h2>{articles.length === 0 ? "Статей пока нет" : "Ничего не найдено"}</h2>
      <p>
        {articles.length === 0
          ? "Статей пока нет."
          : "Измените запрос или сбросьте фильтры."}
      </p>
      <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/articles/new?section=${newSection}`)}>
        <Icon name="plus" size={15} /> Новая статья
      </button>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Статья</th>
            <th>Раздел</th>
            <th>Порядок</th>
            <th>Обновлено</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as article (article.slug)}
            <tr class="is-clickable" onclick={() => navigate(`/article/${article.slug}`)}>
              <td>
                <div class="table__title">
                  <b>{article.title.ru || article.title.en || article.slug}</b>
                  <small>{article.slug}</small>
                </div>
              </td>
              <td>{sectionTitle.get(article.section) ?? article.section}</td>
              <td>{article.order}</td>
              <td>{formatDate(article.updated)}</td>
              <td>
                {#if article.error}
                  <span class="badge badge--bad" title={article.error}>ошибка</span>
                {:else if article.draft}
                  <span class="badge badge--warn">черновик</span>
                {:else}
                  <span class="badge badge--ok">опубликована</span>
                {/if}
                {#if !article.hasRu}
                  <span class="badge badge--bad">нет RU</span>
                {/if}
                {#if !article.hasEn}
                  <span class="badge badge--bad">нет EN</span>
                {/if}
                {#if article.orderMismatch}
                  <span class="badge badge--warn">order ≠</span>
                {/if}
                {#if article.draftMismatch}
                  <span class="badge badge--warn">draft ≠</span>
                {/if}
              </td>
              <td>
                <div class="table__actions">
                  <a class="icon-btn" href={`#/article/${article.slug}`} title="Редактировать" onclick={(event) => event.stopPropagation()}>
                    <Icon name="edit" size={15} />
                  </a>
                  <a class="icon-btn" href={siteUrl(article)} target="_blank" rel="noopener" title="Открыть на сайте" onclick={(event) => event.stopPropagation()}>
                    <Icon name="external" size={15} />
                  </a>
                  <button class="icon-btn" type="button" title="Дублировать" onclick={(event) => { event.stopPropagation(); duplicate(article); }}>
                    <Icon name="copy" size={15} />
                  </button>
                  <button class="icon-btn icon-btn--danger" type="button" title="Удалить" onclick={(event) => { event.stopPropagation(); remove(article); }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
