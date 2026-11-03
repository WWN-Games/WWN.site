<script lang="ts">
  import { onMount } from "svelte";

  import type { AskConfirm, GitStatus, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import Icon from "./Icon.svelte";

  interface Props {
    toast: ToastFn;
    askConfirm: AskConfirm;
    refresh: () => void;
  }

  const { toast, askConfirm, refresh }: Props = $props();

  let status = $state<GitStatus>({
  branch: "—",
  dirty: false,
  files: [],
  ahead: 0,
  behind: 0,
  upstream: null,
  lastCommit: "",
});
  let selected = $state<string[]>([]);
  let diff = $state("");
  let diffFile = $state("");
  let message = $state("");
  let output = $state("");
  let error = $state("");
  let loading = $state(false);
  let diffLoading = $state(false);
  let committing = $state(false);
  let pushing = $state(false);

  function statusLabel(code: string): string {
    if (code === "??") return "новый";
    if (code.includes("M")) return "изменён";
    if (code.includes("A")) return "добавлен";
    if (code.includes("D")) return "удалён";
    if (code.includes("R")) return "переименован";
    return code;
  }

  function applyStatus(next: GitStatus, selectAll = false): void {
    status = next;
    const available = new Set(next.files.map((file) => file.path));
    selected = selected.filter((path) => available.has(path));
    if (selectAll) selected = next.files.map((file) => file.path);
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      applyStatus(await api.get<GitStatus>("/api/git/status"));
      if (!message) {
        message = `content: обновление ${new Date().toISOString().slice(0, 10)}`;
      }
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  function toggle(path: string): void {
    selected = selected.includes(path)
      ? selected.filter((item) => item !== path)
      : [...selected, path];
  }

  function toggleAll(): void {
    selected = selected.length === status.files.length ? [] : status.files.map((file) => file.path);
  }

  async function showDiff(path: string): Promise<void> {
    diffLoading = true;
    diffFile = path;
    try {
      const result = await api.get<{ diff: string }>(`/api/git/diff?file=${encodeURIComponent(path)}`);
      diff = result.diff;
    } catch (cause) {
      diff = cause instanceof Error ? cause.message : String(cause);
    } finally {
      diffLoading = false;
    }
  }

  async function commit(): Promise<void> {
    if (selected.length === 0) {
      toast("Выберите файлы для коммита", "warn");
      return;
    }
    if (!message.trim()) {
      toast("Введите сообщение коммита", "warn");
      return;
    }
    committing = true;
    error = "";
    try {
      const result = await api.post<{ output: string; status: GitStatus }>(
        "/api/git/commit",
        { files: selected, message },
        120_000,
      );
      output = result.output;
      applyStatus(result.status);
      message = `content: обновление ${new Date().toISOString().slice(0, 10)}`;
      selected = [];
      diff = "";
      toast("Коммит создан");
      refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      toast(error, "error");
    } finally {
      committing = false;
    }
  }

  async function push(): Promise<void> {
    const ok = await askConfirm({
      title: "Отправить изменения на GitHub?",
      message: `git push в ветку ${status.branch}. Это запустит CI и деплой, если ветка main.`,
      confirmLabel: "Push",
    });
    if (!ok) return;
    pushing = true;
    error = "";
    try {
      const result = await api.post<{ output: string; status: GitStatus }>(
        "/api/git/push",
        {},
        120_000,
      );
      output = result.output;
      applyStatus(result.status);
      toast("Изменения отправлены");
      refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      toast(error, "error");
    } finally {
      pushing = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="page-head">
  <div>
    <div class="eyebrow">Публикация</div>
    <h1>Git</h1>
  </div>
  <div class="page-head__actions">
    <button class="btn btn--ghost btn--small" type="button" disabled={loading} onclick={load}>
      <Icon name="refresh" size={15} /> Обновить
    </button>
    <button class="btn btn--cyan btn--small" type="button" disabled={pushing} onclick={push}>
      <Icon name="git" size={15} /> {pushing ? "Пушу…" : "Push"}
    </button>
  </div>
</div>

{#if error}
  <div class="error-box" style="margin-bottom: 16px">{error}</div>
{/if}


<div class="dashboard-grid">
  <section class="panel">
    <div class="panel__head">
      <h2>Изменённые файлы</h2>
      <span>{status.files.length}</span>
      {#if status.files.length > 0}
        <button class="btn btn--ghost btn--small" type="button" style="margin-left:auto" onclick={toggleAll}>
          {selected.length === status.files.length ? "Снять всё" : "Выбрать всё"}
        </button>
      {/if}
    </div>
    {#if loading}
      <div class="loading" style="min-height: 180px"><span class="spinner"></span>Читаю git status…</div>
    {:else if status.files.length === 0}
      <div class="empty">
        <div class="empty__icon"><Icon name="checkCircle" size={24} /></div>
        <h2>Дерево чистое</h2>
        <p class="aside-note">Нет изменений.</p>
      </div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 34px"></th>
              <th>Файл</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each status.files as file (file.path)}
              <tr class="is-clickable" onclick={() => showDiff(file.path)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(file.path)}
                    onclick={(event) => event.stopPropagation()}
                    onchange={() => toggle(file.path)}
                  />
                </td>
                <td><code>{file.path}</code></td>
                <td>
                  <span class="badge" class:badge--warn={file.status === "??"}>{statusLabel(file.status)}</span>
                  {#if file.staged}<span class="badge badge--ok">в индексе</span>{/if}
                </td>
                <td>
                  <button class="btn btn--ghost btn--small" type="button" onclick={(event) => { event.stopPropagation(); showDiff(file.path); }}>
                    diff
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <div style="display: grid; gap: 16px; align-content: start">
    <section class="panel">
      <div class="panel__head"><h2>Коммит</h2></div>
      <div class="panel__body" style="display: grid; gap: 10px">
        <div class="field">
          <label for="commit-message">Сообщение</label>
          <input id="commit-message" bind:value={message} placeholder="content: добавить статью" />
        </div>
        <div class="aside-row">
          <span class="aside-note">Выбрано файлов: {selected.length}</span>
          <button class="btn btn--cyan btn--small" type="button" disabled={committing || selected.length === 0} onclick={commit}>
            <Icon name="save" size={14} /> {committing ? "Коммичу…" : "Commit"}
          </button>
        </div>
        <p class="aside-note">Только выбранные файлы.</p>
      </div>
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2>Вывод</h2>
        {#if diffFile}<span>{diffFile}</span>{/if}
      </div>
      <div class="panel__body">
        {#if output}
          <pre class="git-output">{output}</pre>
        {:else if diffFile}
          {#if diffLoading}
            <div class="loading" style="min-height: 100px">Читаю diff…</div>
          {:else}
            <pre class="git-output">{diff}</pre>
          {/if}
        {:else}
          <p class="aside-note">Выберите файл, чтобы посмотреть diff, или создайте коммит.</p>
        {/if}
      </div>
    </section>

    <section class="panel">
      <div class="panel__head"><h2>Последний коммит</h2></div>
      <div class="panel__body">
        <p class="aside-note" style="font-family: var(--font-mono); overflow-wrap: anywhere">
          {status.lastCommit || "—"}
        </p>
      </div>
    </section>
  </div>
</div>
