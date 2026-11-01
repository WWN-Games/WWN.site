<script lang="ts">
  import type { Bootstrap } from "../../shared/types";
  import { formatCount, formatDate } from "../lib/format";
  import Icon from "./Icon.svelte";

  interface Props {
    bootstrap: Bootstrap;
    navigate: (path: string) => void;
  }

  const { bootstrap, navigate }: Props = $props();

  const firstSection = $derived(bootstrap.sections[0]?.id ?? "misc");
  const cards = $derived(bootstrap.counts.units + bootstrap.counts.buildings);
</script>

<div class="page-head">
  <div>
    <div class="eyebrow">WWN · админка</div>
    <h1>Обзор</h1>
  </div>
  <div class="page-head__actions">
    <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/articles/new?section=${firstSection}`)}>
      <Icon name="plus" size={15} />
      Новая статья
    </button>
    <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate("/collections/units/new")}>
      <Icon name="cube" size={15} />
      Новый юнит
    </button>
  </div>
</div>

<div class="stats-grid">
  <div class="stat">
    <div class="stat__label">Статьи</div>
    <div class="stat__value">{formatCount(bootstrap.counts.articles)}</div>
    <div class="stat__hint">
      {formatCount(bootstrap.counts.drafts)} черновиков · {formatCount(bootstrap.counts.sections)} разделов
    </div>
  </div>
  <div class="stat">
    <div class="stat__label">Карточки</div>
    <div class="stat__value">{formatCount(cards)}</div>
    <div class="stat__hint">
      {formatCount(bootstrap.counts.units)} юнитов · {formatCount(bootstrap.counts.buildings)} строений
    </div>
  </div>
  <div class="stat">
    <div class="stat__label">Фракции и теги</div>
    <div class="stat__value">{formatCount(bootstrap.counts.factions)} / {formatCount(bootstrap.counts.tags)}</div>
    <div class="stat__hint">фракции / теги</div>
  </div>
  <div class="stat" class:stat--gold={bootstrap.git.dirty} class:stat--red={!bootstrap.validation.ok}>
    <div class="stat__label">Состояние</div>
    <div class="stat__value">{bootstrap.validation.ok ? "OK" : `${bootstrap.validation.errors.length}`}</div>
    <div class="stat__hint">
      {bootstrap.validation.ok ? "валидация пройдена" : "ошибок валидации"} · {bootstrap.git.dirty ? "есть изменения" : "дерево чистое"}
    </div>
  </div>
</div>

{#if bootstrap.warnings.length > 0}
  <div class="warning-list" style="margin-bottom: 18px">
    {#each bootstrap.warnings as warning}
      <div class="warning" class:warning--error={!bootstrap.validation.ok}>
        <Icon name="warning" size={15} />
        <span>{warning}</span>
      </div>
    {/each}
  </div>
{/if}

<div class="dashboard-grid">
  <div style="display: grid; gap: 16px; min-width: 0">
    <section class="panel">
      <div class="panel__head">
        <h2>Последние статьи</h2>
        <span>по времени изменения</span>
        <a class="btn btn--ghost btn--small" href="#/articles" style="margin-left: auto">Все статьи</a>
      </div>
      {#if bootstrap.recentArticles.length === 0}
        <div class="empty">
          <div class="empty__icon"><Icon name="article" size={24} /></div>
          <h2>Статей пока нет</h2>
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
              </tr>
            </thead>
            <tbody>
              {#each bootstrap.recentArticles as article}
                <tr class="is-clickable" onclick={() => navigate(`/article/${article.slug}`)}>
                  <td>
                    <div class="table__title">
                      <b>{article.title.ru || article.title.en || article.slug}</b>
                      <small>{article.slug}</small>
                    </div>
                  </td>
                  <td>{article.section}</td>
                  <td>{article.order}</td>
                  <td>{formatDate(article.updated)}</td>
                  <td>
                    {#if article.error}
                      <span class="badge badge--bad">ошибка</span>
                    {:else if article.draft}
                      <span class="badge badge--warn">черновик</span>
                    {:else}
                      <span class="badge badge--ok">опубликована</span>
                    {/if}
                    {#if !article.hasRu || !article.hasEn}
                      <span class="badge badge--bad">нет {article.hasRu ? "EN" : "RU"}</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2>Быстрые действия</h2>
      </div>
      <div class="panel__body quick-actions">
        <button class="btn btn--cyan btn--small" type="button" onclick={() => navigate(`/articles/new?section=${firstSection}`)}>
          <Icon name="article" size={15} /> Новая статья
        </button>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate("/collections/units/new")}>
          <Icon name="cube" size={15} /> Новый юнит
        </button>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate("/collections/buildings/new")}>
          <Icon name="building" size={15} /> Новое строение
        </button>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate("/collections/factions/new")}>
          <Icon name="shield" size={15} /> Новая фракция
        </button>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate("/collections/tags/new")}>
          <Icon name="tag" size={15} /> Новый тег
        </button>
      </div>
    </section>
  </div>

  <div style="display: grid; gap: 16px; align-content: start">
    <section class="panel">
      <div class="panel__head">
        <h2>Валидация</h2>
        {#if bootstrap.validation.ok}
          <span class="badge badge--ok">всё чисто</span>
        {:else}
          <span class="badge badge--bad">{bootstrap.validation.errors.length}</span>
        {/if}
      </div>
      <div class="panel__body" style="display: grid; gap: 10px">
        {#if bootstrap.validation.ok}
          <div class="success-box">Схемы, ссылки, картинки и RU/EN-паритет в порядке.</div>
        {:else}
          {#each bootstrap.validation.errors.slice(0, 4) as error}
            <div class="warning warning--error" style="font-family: var(--font-mono); font-size: 11px">
              {error}
            </div>
          {/each}
          {#if bootstrap.validation.errors.length > 4}
            <p class="aside-note">И ещё {bootstrap.validation.errors.length - 4}…</p>
          {/if}
        {/if}
        <a class="btn btn--ghost btn--small" href="#/validation">Открыть проверку</a>
      </div>
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2>Сайт и Git</h2>
      </div>
      <div class="panel__body aside-list">
        <div class="aside-row">
          <span>Сайт</span>
          <b>
            {#if bootstrap.site.running}
              <span class="badge badge--ok">запущен</span>
            {:else}
              <span class="badge badge--warn">не запущен</span>
            {/if}
          </b>
        </div>
        <div class="aside-row">
          <span>Ветка</span>
          <b>{bootstrap.git.branch}</b>
        </div>
        <div class="aside-row">
          <span>Изменения</span>
          <b>{bootstrap.git.dirty ? `${bootstrap.git.files.length} файлов` : "нет"}</b>
        </div>
        {#if !bootstrap.site.running}
          <p class="aside-note"><code>pnpm dev</code> для предпросмотра.</p>
        {/if}
        <a class="btn btn--ghost btn--small" href="#/git">Открыть Git</a>
      </div>
    </section>
  </div>
</div>
