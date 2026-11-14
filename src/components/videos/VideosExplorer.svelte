<script lang="ts">
  import { t } from "@/i18n";
  import type { VideoItem } from "@/lib/schemas";
  import type { Lang } from "@/lib/site";

  interface Props {
    lang: Lang;
    items: VideoItem[];
  }

  const { lang, items }: Props = $props();

  let filter = $state<"all" | "ru" | "en">("all");
  let playing = $state<Record<string, boolean>>({});

  const visible = $derived(items.filter((item) => filter === "all" || item.lang === filter));
  const labels = $derived({
    all: t(lang, "videos.all"),
    ru: t(lang, "videos.ru"),
    en: t(lang, "videos.en"),
    watch: t(lang, "videos.watch"),
    empty: t(lang, "videos.empty"),
  });

  function play(item: VideoItem): void {
    playing = { ...playing, [item.id]: true };
  }
</script>

<fieldset class="videos-filter">
  <legend class="visually-hidden">{t(lang, "videos.title")}</legend>
  <button type="button" class:is-active={filter === "all"} aria-pressed={filter === "all"} onclick={() => (filter = "all")}>
    {labels.all}
  </button>
  <button type="button" class:is-active={filter === "ru"} aria-pressed={filter === "ru"} onclick={() => (filter = "ru")}>
    {labels.ru}
  </button>
  <button type="button" class:is-active={filter === "en"} aria-pressed={filter === "en"} onclick={() => (filter = "en")}>
    {labels.en}
  </button>
</fieldset>

{#if visible.length === 0}
  <p class="empty-block">{labels.empty}</p>
{:else}
  <div class="videos-grid">
    {#each visible as item (item.id)}
      <article class="video-card">
        {#if playing[item.id]}
          <div class="video-card__frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
              title={item.title[lang]}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy"
            ></iframe>
          </div>
        {:else}
          <button class="video-card__thumb" type="button" onclick={() => play(item)} aria-label={labels.watch}>
            <img
              src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
              alt=""
              width="480"
              height="360"
              loading="lazy"
              decoding="async"
            />
            <span class="video-card__play" aria-hidden="true">▶</span>
            <span class="video-card__lang">{item.lang.toUpperCase()}</span>
          </button>
        {/if}
        <h2>{item.title[lang]}</h2>
        {#if item.desc}<p>{item.desc[lang]}</p>{/if}
        <a class="video-card__link" href={`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noopener">
          {labels.watch}
        </a>
      </article>
    {/each}
  </div>
{/if}

<style>
  .videos-filter {
    display: flex;
    gap: 8px;
    margin: 0 0 22px;
    padding: 0;
    border: 0;
  }
  .videos-filter button {
    padding: 8px 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface-1);
    color: var(--muted);
  }
  .videos-filter button.is-active {
    color: #fff;
    border-color: var(--cyan);
    background: var(--surface-2);
  }
  .videos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 18px;
  }
  .video-card {
    display: grid;
    gap: 10px;
    align-content: start;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-1);
  }
  .video-card__thumb,
  .video-card__frame {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    padding: 0;
    border: 0;
    border-radius: var(--radius-xs);
    background: var(--surface-2);
  }
  .video-card__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .video-card__frame iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
  .video-card__play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 34px;
    color: #fff;
    background: rgba(0, 0, 0, 0.28);
  }
  .video-card__lang {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: #fff;
    border-radius: 999px;
    background: rgba(4, 10, 20, 0.78);
  }
  .video-card h2 {
    margin: 0;
    font-size: 17px;
  }
  .video-card p {
    margin: 0;
    color: var(--muted);
    font-size: 13.5px;
  }
  .video-card__link {
    color: var(--cyan);
    font-size: 13px;
  }
</style>
