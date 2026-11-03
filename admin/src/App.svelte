<script lang="ts">
  import { onMount } from "svelte";

  import type { Bootstrap, ToastItem } from "../shared/types";
  import ArticleEditor from "./components/ArticleEditor.svelte";
  import ArticlesPage from "./components/ArticlesPage.svelte";
  import CollectionsPage from "./components/CollectionsPage.svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import GitPage from "./components/GitPage.svelte";
  import ItemEditor from "./components/ItemEditor.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import Toasts from "./components/Toasts.svelte";
  import Topbar from "./components/Topbar.svelte";
  import ValidationPage from "./components/ValidationPage.svelte";
  import { api } from "./lib/api";
  import { dirty } from "./lib/dirty.svelte";
  import { parseRoute, type Route, routeKey } from "./lib/routes";

  interface ConfirmState {
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    resolve: (value: boolean) => void;
  }

  let bootstrap = $state<Bootstrap | null>(null);
  let loading = $state(true);
  let loadError = $state("");
  let route = $state<Route>(parseRoute(window.location.hash));
  let sidebarOpen = $state(false);
  let toasts = $state<ToastItem[]>([]);
  let toastSeq = 0;
  let confirmState = $state<ConfirmState | null>(null);

  async function load(silent = false): Promise<void> {
    if (!silent) loading = true;
    try {
      bootstrap = await api.get<Bootstrap>("/api/bootstrap");
      loadError = "";
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function toast(message: string, type: ToastItem["type"] = "ok"): void {
    const id = ++toastSeq;
    toasts = [...toasts, { id, message, type }];
    window.setTimeout(() => {
      toasts = toasts.filter((item) => item.id !== id);
    }, 5200);
  }

  function closeToast(id: number): void {
    toasts = toasts.filter((item) => item.id !== id);
  }

  function askConfirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState = {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Подтвердить",
        danger: options.danger ?? false,
        resolve,
      };
    });
  }

  function resolveConfirm(value: boolean): void {
    const state = confirmState;
    confirmState = null;
    state?.resolve(value);
  }

  function navigate(path: string): void {
    if (dirty.value) {
      void askConfirm({
        title: "Есть несохранённые изменения",
        message: "Перейти в другой раздел и потерять изменения?",
        confirmLabel: "Перейти",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        dirty.value = false;
        window.location.hash = path;
      });
      return;
    }
    window.location.hash = path;
  }

  function refresh(): void {
    void load(true);
  }

  onMount(() => {
    void load();

    const onHash = (): void => {
      route = parseRoute(window.location.hash);
      sidebarOpen = false;
    };
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!dirty.value) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onDocumentClick = (event: MouseEvent): void => {
      if (!dirty.value) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href^="#/"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      void askConfirm({
        title: "Есть несохранённые изменения",
        message: "Перейти по ссылке и потерять изменения?",
        confirmLabel: "Перейти",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        dirty.value = false;
        window.location.hash = href.slice(1);
      });
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && confirmState) resolveConfirm(false);
    };

    window.addEventListener("hashchange", onHash);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("keydown", onKey);
    const onFocus = (): void => {
      void load(true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("focus", onFocus);
    };
  });
</script>

{#if loading && !bootstrap}
  <div class="loading">
    <span class="spinner"></span>
    Загружаю админку…
  </div>
{:else if !bootstrap}
  <div class="empty" style="min-height: 80vh">
    <div class="empty__icon">!</div>
    <h2>Админка не смогла загрузиться</h2>
    <p>{loadError || "Сервер не отвечает."}</p>
    <button class="btn btn--cyan btn--sm" type="button" onclick={() => load()}>Попробовать снова</button>
  </div>
{:else}
  <div class="admin-shell">
    <Sidebar
      {route}
      counts={bootstrap.counts}
      validation={bootstrap.validation}
      git={bootstrap.git}
      open={sidebarOpen}
      onclose={() => (sidebarOpen = false)}
    />

    <div class="main">
      <Topbar
        {route}
        {bootstrap}
        onmenu={() => (sidebarOpen = true)}
        onrefresh={refresh}
      />

      <main class="page" class:page--narrow={route.view === "validation" || route.view === "git"}>
        {#key routeKey(route)}
          {#if route.view === "dashboard"}
            <Dashboard {bootstrap} {navigate} />
          {:else if route.view === "articles"}
            <ArticlesPage
              {bootstrap}
              {navigate}
              {toast}
              {askConfirm}
              refresh={refresh}
            />
          {:else if route.view === "article"}
            <ArticleEditor
              slug={route.slug}
              newSection={route.section}
              {bootstrap}
              {navigate}
              {refresh}
              {toast}
              {askConfirm}
            />
          {:else if route.view === "collections"}
            <CollectionsPage
              name={route.name}
              {bootstrap}
              {navigate}
              {toast}
              {askConfirm}
              refresh={refresh}
            />
          {:else if route.view === "item"}
            <ItemEditor
              name={route.name}
              id={route.id}
              {bootstrap}
              {navigate}
              {refresh}
              {toast}
              {askConfirm}
            />
          {:else if route.view === "validation"}
            <ValidationPage {navigate} {toast} initial={bootstrap.validation} />
          {:else if route.view === "git"}
            <GitPage {toast} {askConfirm} {refresh} />
          {/if}
        {/key}
      </main>
    </div>
  </div>
{/if}

<Toasts items={toasts} onclose={closeToast} />

{#if confirmState}
  <!-- biome-ignore lint/a11y/noStaticElementInteractions: клик по подложке закрывает модалку -->
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) resolveConfirm(false);
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{confirmState.title}</h2>
      <p>{confirmState.message}</p>
      <div class="modal__actions">
        <button class="btn btn--ghost btn--small" type="button" onclick={() => resolveConfirm(false)}>
          Отмена
        </button>
        <button
          class="btn btn--small"
          class:btn--danger={confirmState.danger}
          class:btn--cyan={!confirmState.danger}
          type="button"
          onclick={() => resolveConfirm(true)}
        >
          {confirmState.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
