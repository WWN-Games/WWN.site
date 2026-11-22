<script lang="ts">
  import type { VideoItem } from "@/lib/schemas";
  import type { Lang } from "@/lib/site";

  interface Labels {
    title: string;
    all: string;
    ru: string;
    en: string;
    watch: string;
    empty: string;
  }

  interface Props {
    lang: Lang;
    items: VideoItem[];
    labels: Labels;
  }

  const { lang, items, labels }: Props = $props();

  let filter = $state<"all" | "ru" | "en">("all");
  let playing = $state<Record<string, boolean>>({});

  const visible = $derived(items.filter((item) => filter === "all" || item.lang === filter));

  function play(item: VideoItem): void {
    playing = { ...playing, [item.id]: true };
  }
</script>

<fieldset class="segmented videos-filter">
  <legend class="visually-hidden">{labels.title}</legend>
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
  <div class="empty-state"><p>{labels.empty}</p></div>
{:else}
  <div class="catalog-grid">
    {#each visible as item (item.id)}
      <article class="catalog-card video-card">
        {#if playing[item.id]}
          <div class="catalog-card__media video-card__frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
              title={item.title[lang]}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy"
            ></iframe>
          </div>
        {:else}
          <button class="catalog-card__media video-card__thumb" type="button" onclick={() => play(item)} aria-label={labels.watch}>
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
        <h2 class="catalog-card__title">{item.title[lang]}</h2>
        {#if item.desc}<p class="catalog-card__desc">{item.desc[lang]}</p>{/if}
        <div class="catalog-card__footer">
          <a class="video-card__link" href={`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noopener">
            {labels.watch}
          </a>
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .videos-filter {
    margin: 0 0 var(--space-5);
  }
  .video-card__thumb,
  .video-card__frame {
    padding: 0;
    border: 0;
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
    top: var(--space-2);
    left: var(--space-2);
    padding: 2px var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: #fff;
    border-radius: var(--radius-pill);
    background: rgba(4, 10, 20, 0.78);
  }
  .video-card__link {
    color: var(--cyan);
    font-size: var(--text-base);
  }
</style>
