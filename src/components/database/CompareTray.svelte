<script lang="ts">
/* ============================================================================
   WWN — нижняя панель выбранных для сравнения карточек.
   Показывает выбор и передаёт действия наверх, в DatabaseExplorer.
   ============================================================================ */

import { CloseSmall } from "@icon-park/svg";

import { iconSvg } from "@/components/ui/icon";
import type { ExplorerItem, ExplorerLabels } from "@/lib/database";

interface Props {
  items: ExplorerItem[];
  labels: ExplorerLabels["compare"];
  max: number;
  onopen: () => void;
  onclear: () => void;
  onremove: (id: string) => void;
}

let { items, labels, max, onopen, onclear, onremove }: Props = $props();

const countText = $derived(
  labels.selected.replace("{n}", String(items.length)).replace("{max}", String(max)),
);
const hint = $derived(
  items.length < 2 ? labels.hint.replace("{n}", String(2 - items.length)) : "",
);
const openText = $derived(labels.open.replace("{n}", String(items.length)));

function removeLabel(name: string): string {
  return labels.removeAria.replace("{name}", name);
}
</script>

<aside class="compare-tray" aria-label={labels.trayLabel}>
  <div class="compare-tray__main">
    <div class="compare-tray__head">
      <span class="compare-tray__title">{labels.title}</span>
      <span class="compare-tray__count">{countText}</span>
    </div>

    <div class="compare-tray__items">
      {#each items as item (item.id)}
        <span class="compare-chip" style={`--faction-color:${item.factionColor}`}>
          <span class="compare-chip__img" aria-hidden="true">
            {#if item.image}
              <img src={item.image} alt="" width="24" height="24" loading="lazy" decoding="async" />
            {:else}
              {item.initials}
            {/if}
          </span>
          <span class="compare-chip__name">{item.name}</span>
          <button
            class="compare-chip__remove"
            type="button"
            aria-label={removeLabel(item.name)}
            onclick={() => onremove(item.id)}
          >
            {@html iconSvg(CloseSmall)}
          </button>
        </span>
      {/each}
    </div>
  </div>

  <div class="compare-tray__actions">
    {#if hint}<span class="compare-tray__hint">{hint}</span>{/if}
    <button class="btn btn--sm" type="button" onclick={onclear}>{labels.clear}</button>
    <button class="btn btn--cyan btn--sm" type="button" disabled={items.length < 2} onclick={onopen}>
      {openText}
    </button>
  </div>
</aside>
