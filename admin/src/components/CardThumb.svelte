<script lang="ts">
  import { cardImageUrl } from "../lib/format";

  interface Props {
    id: string;
    image?: string;
    name: string;
  }

  const { id, image, name }: Props = $props();

  let failed = $state(false);

  $effect(() => {
    image;
    id;
    failed = false;
  });

  const url = $derived(image === "" ? "" : cardImageUrl({ id, image }));
  const initials = $derived(name.slice(0, 2).toUpperCase() || id.slice(0, 2).toUpperCase());
</script>

{#if url && !failed}
  <img class="table__thumb" src={url} alt="" loading="lazy" onerror={() => (failed = true)} />
{:else}
  <span class="thumb-fallback">{initials}</span>
{/if}
