<script lang="ts">
  import type { ToastFn, ValidationState } from "../../shared/types";
  import { api } from "../lib/api";
  import Icon from "./Icon.svelte";

  interface Props {
    navigate: (path: string) => void;
    toast: ToastFn;
    initial: ValidationState;
    refresh: () => void;
  }

  const { navigate, toast, initial, refresh }: Props = $props();

  let state = $state<ValidationState>({ ok: true, errors: [], checkedAt: "" });
  let running = $state(false);

  $effect(() => {
    state = initial;
  });

  function routeFor(error: string): string | null {
    const article = /src\/content\/wiki\/(?:ru|en)\/([^/]+)\/(.+?)\.md/.exec(error);
    if (article) return `/article/${article[1]}/${article[2]}`;
    const data = /src\/data\/(units|buildings|factions|tags|sections)\.json/.exec(error);
    if (data) return `/collections/${data[1]}`;
    if (error.includes("src/data/stats.json")) return null;
    return null;
  }

  async function run(): Promise<void> {
    running = true;
    try {
      state = await api.post<ValidationState>("/api/validate", {});
      toast(state.ok ? "Валидация пройдена" : `Найдено ошибок: ${state.errors.length}`, state.ok ? "ok" : "warn");
      refresh();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    } finally {
      running = false;
    }
  }

  const checked = $derived(
    state.checkedAt ? new Date(state.checkedAt).toLocaleString("ru-RU") : "—",
  );

</script>

<div class="page-head">
  <div>
    <div class="eyebrow">Контроль качества</div>
    <h1>Проверка контента</h1>
  </div>
  <div class="page-head__actions">
    <span class="badge" class:badge--ok={state.ok} class:badge--bad={!state.ok}>
      {state.ok ? "всё чисто" : `${state.errors.length} ошибок`}
    </span>
    <button class="btn btn--cyan btn--small" type="button" disabled={running} onclick={run}>
      <Icon name="refresh" size={15} />
      {running ? "Проверяю…" : "Проверить снова"}
    </button>
  </div>
</div>

<div class="stats-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr))">
  <div class="stat">
    <div class="stat__label">Статус</div>
    <div class="stat__value">{state.ok ? "OK" : state.errors.length}</div>
    <div class="stat__hint">{state.ok ? "можно коммитить" : "ошибок в контенте"}</div>
  </div>
  <div class="stat">
    <div class="stat__label">Последняя проверка</div>
    <div class="stat__value" style="font-size: 16px; line-height: 1.4; padding-top: 5px">{checked}</div>
    <div class="stat__hint">локальное время</div>
  </div>
  <div class="stat">
    <div class="stat__label">Команда</div>
    <div class="stat__value" style="font-size: 15px; line-height: 1.4; padding-top: 6px">
      <code>pnpm validate</code>
    </div>
    <div class="stat__hint">тот же результат в терминале и CI</div>
  </div>
</div>

<section class="panel">
  <div class="panel__head">
    <h2>{state.ok ? "Ошибок нет" : "Ошибки"}</h2>
    <span>{state.errors.length}</span>
  </div>
  <div class="panel__body" style="display: grid; gap: 8px">
    {#if state.ok}
      <div class="success-box">Ошибок нет.</div>
    {:else}
      {#each state.errors as error, index}
        {@const route = routeFor(error)}
        <div class="warning warning--error" style="align-items: flex-start; font-family: var(--font-mono); font-size: 11.5px">
          <span style="opacity: .55; min-width: 24px">{index + 1}.</span>
          <span style="flex: 1; overflow-wrap: anywhere">{error}</span>
          {#if route}
            <button class="btn btn--ghost btn--small" type="button" onclick={() => navigate(route)}>
              Открыть
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</section>


