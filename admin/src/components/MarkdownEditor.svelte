<script lang="ts">
  import { onDestroy } from "svelte";

  import type { Lang, PreviewResult, ToastFn, UploadResult } from "../../shared/types";
  import { api } from "../lib/api";
  import Icon from "./Icon.svelte";

  interface Props {
    value: string;
    lang: Lang;
    section: string;
    slug: string;
    toast: ToastFn;
    placeholder?: string;
  }

  let {
    value = $bindable(""),
    lang,
    section,
    slug,
    toast,
    placeholder = "Текст статьи в Markdown…",
  }: Props = $props();

  let textarea = $state<HTMLTextAreaElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let iframe = $state<HTMLIFrameElement | null>(null);
  let showPreview = $state(true);
  let uploading = $state(false);
  let previewHtml = $state("");
  let previewCss = $state("");
  let previewError = $state("");
  let previewLoading = $state(false);
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const words = $derived(value.trim() ? value.trim().split(/\s+/).length : 0);
  const chars = $derived(value.length);

  const previewDoc = $derived(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<style>${previewCss}
.markdown-preview-loading { color: var(--muted); font: 13px var(--font-body); }
</style>
</head>
<body>
  <div class="article__body is-ready">${previewHtml || `<p class="preview-empty">Предпросмотр появится здесь.</p>`}</div>
</body>
</html>`);

  $effect(() => {
    const body = value;
    const currentLang = lang;
    const currentSection = section;
    const currentSlug = slug;
    if (!showPreview) return;

    clearTimeout(timer);
    const currentSeq = ++seq;
    previewLoading = true;
    timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await api.post<PreviewResult>("/api/preview", {
            lang: currentLang,
            section: currentSection,
            slug: currentSlug,
            body,
          });
          if (currentSeq !== seq) return;
          previewHtml = result.html;
          previewCss = result.css;
          previewError = "";
        } catch (cause) {
          if (currentSeq !== seq) return;
          previewError = cause instanceof Error ? cause.message : String(cause);
        } finally {
          if (currentSeq === seq) previewLoading = false;
        }
      })();
    }, 420);

    return () => {
      clearTimeout(timer);
    };
  });

  $effect(() => {
    if (iframe) iframe.srcdoc = previewDoc;
  });

  onDestroy(() => {
    clearTimeout(timer);
    seq += 1;
  });

  function focusRange(start: number, end: number): void {
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }

  function insert(text: string): void {
    if (!textarea) {
      value += text;
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    value = value.slice(0, start) + text + value.slice(end);
    focusRange(start + text.length, start + text.length);
  }

  function wrap(before: string, after: string, fallback = "текст"): void {
    if (!textarea) {
      value += `${before}${fallback}${after}`;
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    value = value.slice(0, start) + before + selected + after + value.slice(end);
    focusRange(start + before.length, start + before.length + selected.length);
  }

  function prefixLines(prefix: string): void {
    if (!textarea) {
      value = value
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, blockEnd) || "";
    const next = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    value = value.slice(0, lineStart) + next + value.slice(blockEnd);
    focusRange(lineStart + prefix.length, lineStart + next.length);
  }

  function insertLink(): void {
    const url = window.prompt("Ссылка (https://… или ../раздел/статья.md)", "https://");
    if (!url) return;
    wrap("[", `](${url})`);
  }

  function insertCallout(): void {
    insert(
      '\n<div class="callout">\n<strong>Подсказка.</strong> Текст выноски.\n</div>\n',
    );
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) {
      toast("Можно загружать только изображения", "warn");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast("Файл больше 20 МБ", "error");
      return;
    }
    if (!slug.includes("/")) {
      toast("Сначала заполните заголовок и slug статьи", "warn");
      return;
    }
    uploading = true;
    try {
      const dataUrl = await readAsDataUrl(file);
      const fallbackAlt = file.name.replace(/\.[^.]+$/, "");
      const alt = window.prompt("Подпись к изображению (alt)", fallbackAlt) ?? fallbackAlt;
      const result = await api.post<UploadResult>("/api/upload", {
        kind: "article",
        filename: file.name,
        dataUrl,
        slug,
        alt,
      });
      insert(`\n${result.markdown ?? ""}\n`);
      toast("Изображение загружено и вставлено");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : String(cause), "error");
    } finally {
      uploading = false;
      if (fileInput) fileInput.value = "";
    }
  }

  function onPaste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    const first = files[0];
    if (first) void uploadFile(first);
  }

  function onDrop(event: DragEvent): void {
    const files = [...(event.dataTransfer?.files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    const first = files[0];
    if (first) void uploadFile(first);
  }
</script>

<div class="markdown-editor">
  <div class="markdown-toolbar">
    <button type="button" title="Жирный (Ctrl+B)" onclick={() => wrap("**", "**")}>B</button>
    <button type="button" title="Курсив (Ctrl+I)" onclick={() => wrap("*", "*")}><em>I</em></button>
    <button type="button" title="Зачёркнутый" onclick={() => wrap("~~", "~~")}>S</button>
    <span class="sep"></span>
    <button type="button" title="Заголовок 2" onclick={() => prefixLines("## ")}>H2</button>
    <button type="button" title="Заголовок 3" onclick={() => prefixLines("### ")}>H3</button>
    <button type="button" title="Цитата" onclick={() => prefixLines("> ")}>❝</button>
    <button type="button" title="Список" onclick={() => prefixLines("- ")}>•</button>
    <button type="button" title="Нумерованный список" onclick={() => prefixLines("1. ")}>1.</button>
    <span class="sep"></span>
    <button type="button" title="Ссылка" onclick={insertLink}>🔗</button>
    <button type="button" title="Код" onclick={() => wrap("`", "`", "код")}>&lt;/&gt;</button>
    <button type="button" title="Выноска" onclick={insertCallout}>callout</button>
    <button type="button" title="Загрузить изображение" disabled={uploading} onclick={() => fileInput?.click()}>
      {uploading ? "…" : "🖼"}
    </button>
    <span class="spacer"></span>
    <button
      type="button"
      class="toggle"
      class:is-on={showPreview}
      title="Показать/скрыть предпросмотр"
      onclick={() => (showPreview = !showPreview)}
    >
      <Icon name="eye" size={13} /> превью
    </button>
  </div>

  <div class="markdown-body" class:has-preview={showPreview}>
    <textarea
      bind:this={textarea}
      bind:value
      class="markdown-input"
      spellcheck="true"
      {placeholder}
      onpaste={onPaste}
      ondrop={onDrop}
      ondragover={(event) => event.preventDefault()}
      onkeydown={(event) => {
        if (event.ctrlKey || event.metaKey) {
          if (event.key.toLowerCase() === "b") {
            event.preventDefault();
            wrap("**", "**");
          } else if (event.key.toLowerCase() === "i") {
            event.preventDefault();
            wrap("*", "*");
          } else if (event.key.toLowerCase() === "k") {
            event.preventDefault();
            insertLink();
          }
        }
      }}
    ></textarea>
    {#if showPreview}
      <div class="markdown-preview">
        {#if previewError}
          <div class="markdown-hint">
            <div class="error-box">{previewError}</div>
          </div>
        {:else}
          <iframe bind:this={iframe} title="Предпросмотр Markdown" sandbox="allow-same-origin"></iframe>
        {/if}
      </div>
    {/if}
  </div>

  <div class="markdown-foot">
    <span>{words} слов · {chars} символов</span>
    <span class="spacer"></span>
    {#if previewLoading}<span>рендер…</span>{/if}
    <span>Markdown + GFM</span>
  </div>
</div>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  hidden
  onchange={(event) => {
    const file = event.currentTarget.files?.[0];
    if (file) void uploadFile(file);
  }}
/>
