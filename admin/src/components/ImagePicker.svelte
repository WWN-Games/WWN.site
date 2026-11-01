<script lang="ts">
  import type { ToastFn, UploadResult } from "../../shared/types";
  import { api } from "../lib/api";
  import { assetUrl } from "../lib/format";
  import Icon from "./Icon.svelte";

  interface Props {
    kind: "card" | "faction";
    id: string;
    path: string | undefined;
    label: string;
    toast: ToastFn;
    onchange: (path: string) => void;
  }

  const { kind, id, path, label, toast, onchange }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  let failed = $state(false);

  const url = $derived.by(() => {
    if (path === "") return "";
    if (path) return assetUrl(path);
    return kind === "card" && id ? `/media/public/img/database/${id}.avif` : "";
  });

  $effect(() => {
    path;
    failed = false;
  });

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });
  }

  async function upload(file: File): Promise<void> {
    if (kind === "faction" && file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
      toast("Эмблема должна быть SVG", "warn");
      return;
    }
    if (kind === "card" && !file.type.startsWith("image/")) {
      toast("Нужен файл изображения", "warn");
      return;
    }
    if (!id.trim()) {
      toast("Сначала задайте id", "warn");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast("Файл больше 20 МБ", "error");
      return;
    }
    uploading = true;
    try {
      const dataUrl = await readAsDataUrl(file);
      const result = await api.post<UploadResult>("/api/upload", {
        kind,
        id: id.trim(),
        filename: file.name,
        dataUrl,
      });
      onchange(result.path);
      toast(kind === "faction" ? "Эмблема обновлена" : "Изображение загружено");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    } finally {
      uploading = false;
      if (input) input.value = "";
    }
  }
</script>

<div class="image-picker">
  <span class="field__label">{label}</span>
  <div class="image-picker__preview">
    {#if url && !failed}
      <img src={url} alt="" onerror={() => (failed = true)} />
    {:else}
      <div class="image-picker__empty">
        {kind === "faction" ? "Нет эмблемы — загрузите SVG" : "Без картинки — будут инициалы"}
      </div>
    {/if}
  </div>
  <div class="image-picker__actions">
    <button class="btn btn--ghost btn--small" type="button" disabled={uploading} onclick={() => input?.click()}>
      <Icon name="image" size={14} />
      {uploading ? "Загрузка…" : path ? "Заменить" : "Загрузить"}
    </button>
    {#if kind === "card" && path !== ""}
      <button class="btn btn--ghost btn--small" type="button" onclick={() => onchange("")}>
        Без картинки
      </button>
    {/if}
  </div>
  <div class="image-picker__path">
    {path || (kind === "card" && id ? `img/database/${id}.avif (по умолчанию)` : "—")}
  </div>
  <input
    bind:this={input}
    type="file"
    accept={kind === "faction" ? ".svg,image/svg+xml" : "image/*"}
    hidden
    onchange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (file) void upload(file);
    }}
  />
</div>
