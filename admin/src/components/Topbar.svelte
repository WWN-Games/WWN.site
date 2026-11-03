<script lang="ts">
  import type { Bootstrap } from "../../shared/types";
  import type { Route } from "../lib/routes";
  import Icon from "./Icon.svelte";

  interface Props {
    route: Route;
    bootstrap: Bootstrap;
    onmenu: () => void;
    onrefresh: () => void;
  }

  const { route, bootstrap, onmenu, onrefresh }: Props = $props();

  const collectionLabels: Record<string, string> = {
    units: "Юниты",
    buildings: "Строения",
    factions: "Фракции",
    tags: "Теги",
    sections: "Разделы",
  };

  const crumbs = $derived.by(() => {
    switch (route.view) {
      case "dashboard":
        return ["Обзор"];
      case "articles":
        return ["Статьи"];
      case "article": {
        if (!route.slug) return ["Статьи", "Новая статья"];
        const sectionId = route.slug.split("/")[0] ?? "";
        const section = bootstrap.sections.find((item) => item.id === sectionId);
        return ["Статьи", section?.title.ru ?? sectionId, route.slug.split("/").slice(1).join("/")];
      }
      case "collections":
        return [collectionLabels[route.name] ?? route.name];
      case "item":
        return [
          collectionLabels[route.name] ?? route.name,
          route.id ? route.id : "Новая запись",
        ];
      case "validation":
        return ["Проверка контента"];
      case "git":
        return ["Git"];
    }
  });

</script>

<header class="topbar">
  <button class="icon-btn topbar__menu" type="button" aria-label="Открыть меню" onclick={onmenu}>
    <Icon name="menu" size={18} />
  </button>

  <nav class="topbar__crumbs" aria-label="Хлебные крошки">
    {#each crumbs as crumb, index}
      {#if index > 0}<span>/</span>{/if}
      <b>{crumb}</b>
    {/each}
  </nav>

  <div class="topbar__actions">
    <span class="topbar__status" class:is-ok={bootstrap.validation.ok} class:is-bad={!bootstrap.validation.ok}>
      <span class="dot"></span>
      {bootstrap.validation.ok ? "контент валиден" : `${bootstrap.validation.errors.length} ошибок`}
    </span>
    <span class="topbar__status" title={bootstrap.git.lastCommit}>
      <Icon name="git" size={12} />
      {bootstrap.git.branch}{bootstrap.git.dirty ? " *" : ""}
    </span>
    <button class="icon-btn" type="button" title="Обновить данные" onclick={onrefresh}>
      <Icon name="refresh" size={16} />
    </button>
    <a
      class="icon-btn"
      href={bootstrap.site.url}
      target="_blank"
      rel="noopener"
      title="Открыть сайт (нужен pnpm dev)"
    >
      <Icon name="external" size={16} />
    </a>
  </div>
</header>
