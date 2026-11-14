<script lang="ts">
  import type { Bootstrap } from "../../shared/types";
  import type { Route } from "../lib/routes";
  import Icon from "./Icon.svelte";

  interface Props {
    route: Route;
    counts: Bootstrap["counts"];
    validation: Bootstrap["validation"];
    git: Bootstrap["git"];
    open: boolean;
    onclose: () => void;
  }

  const { route, counts, validation, git, open, onclose }: Props = $props();

  const isArticles = $derived(route.view === "articles" || route.view === "article");
  const activeCollection = $derived(
    route.view === "collections" || route.view === "item" ? route.name : "",
  );
  const errorCount = $derived(validation.errors.length);

  const items = $derived([
    { key: "dashboard", label: "Обзор", icon: "dashboard", href: "#/", count: null, active: route.view === "dashboard" },
    { key: "articles", label: "Статьи", icon: "article", href: "#/articles", count: counts.articles, active: isArticles },
    { key: "units", label: "Юниты", icon: "cube", href: "#/collections/units", count: counts.units, active: activeCollection === "units" },
    { key: "buildings", label: "Строения", icon: "building", href: "#/collections/buildings", count: counts.buildings, active: activeCollection === "buildings" },
    { key: "misc", label: "Разное", icon: "layers", href: "#/collections/misc", count: counts.misc, active: activeCollection === "misc" },
    { key: "maps", label: "Карты", icon: "layers", href: "#/collections/maps", count: counts.maps, active: activeCollection === "maps" },
    { key: "gallery", label: "Галерея", icon: "image", href: "#/collections/gallery", count: counts.gallery, active: activeCollection === "gallery" },
    { key: "videos", label: "Видео", icon: "eye", href: "#/collections/videos", count: counts.videos, active: activeCollection === "videos" },
    { key: "feats", label: "Подвиги", icon: "shield", href: "#/collections/feats", count: counts.feats, active: activeCollection === "feats" },
    { key: "factions", label: "Фракции", icon: "shield", href: "#/collections/factions", count: counts.factions, active: activeCollection === "factions" },
    { key: "tags", label: "Теги", icon: "tag", href: "#/collections/tags", count: counts.tags, active: activeCollection === "tags" },
    { key: "sections", label: "Разделы", icon: "layers", href: "#/collections/sections", count: counts.sections, active: activeCollection === "sections" },
  ]);
</script>

{#if open}
  <button class="sidebar-backdrop" type="button" aria-label="Закрыть меню" onclick={onclose}></button>
{/if}

<aside class="sidebar" class:is-open={open}>
  <a class="sidebar__brand" href="#/" onclick={onclose}>
    <img class="sidebar__logo" src="/logo.svg" alt="WWN" width="40" height="40" />
    <span>
      <b>Admin</b>
    </span>
  </a>

  <nav class="sidebar__nav" aria-label="Разделы админки">
    <div class="nav-label">Контент</div>
    {#each items as item}
      <a
        class="nav-item"
        class:is-active={item.active}
        href={item.href}
        onclick={onclose}
      >
        <Icon name={item.icon} size={17} />
        <span>{item.label}</span>
        {#if item.count !== null}
          <span class="nav-item__count">{item.count}</span>
        {/if}
      </a>
    {/each}

    <div class="nav-label">Инструменты</div>
    <a class="nav-item" class:is-active={route.view === "validation"} href="#/validation" onclick={onclose}>
      <Icon name="checkCircle" size={17} />
      <span>Проверка</span>
      {#if errorCount > 0}
        <span class="nav-item__dot" title={`${errorCount} ошибок`}></span>
      {:else}
        <span class="nav-item__count">OK</span>
      {/if}
    </a>
    <a class="nav-item" class:is-active={route.view === "git"} href="#/git" onclick={onclose}>
      <Icon name="git" size={17} />
      <span>Git</span>
      {#if git.dirty}
        <span class="nav-item__dot" title="Есть изменения"></span>
      {:else}
        <span class="nav-item__count">—</span>
      {/if}
    </a>
  </nav>

  <div class="sidebar__foot">
    <div class="sidebar__note">
      Ветка: <code>{git.branch}</code>
      {#if git.upstream}
        · {git.ahead > 0 ? `↑${git.ahead}` : ""}{git.behind > 0 ? ` ↓${git.behind}` : ""}
      {/if}
    </div>
  </div>
</aside>
