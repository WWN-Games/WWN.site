<script lang="ts">
  import { Down } from "@icon-park/svg";

  import { iconSvg } from "@/components/ui/icon";
  import type { TagMatchMode } from "@/lib/database-constants";
  import { formatTemplate } from "@/lib/utils";

  interface TagOptionView {
    id: string;
    label: string;
    count: number;
  }

  interface TagGroupView {
    id: string;
    title: string;
    tags: TagOptionView[];
  }

  interface ModeLabels {
    label: string;
    all: string;
    any: string;
    allHint: string;
    anyHint: string;
    preview: string;
    emptyHint: string;
    clear: string;
    apply: string;
  }

  interface Props {
    id: string;
    label: string;
    title: string;
    buttonLabel: string;
    weapon?: boolean;
    open: boolean;
    groups: TagGroupView[];
    draft: string[];
    mode: TagMatchMode;
    modeLabels: ModeLabels;
    previewCount: number;
    emptyHint: boolean;
    button: HTMLButtonElement | null;
    panel: HTMLDivElement | null;
    onbeforetoggle: (event: ToggleEvent) => void;
    ontoggle: (event: Event) => void;
    onmode: (mode: TagMatchMode) => void;
    ontag: (id: string) => void;
    onclear: () => void;
    onapply: () => void;
  }

  let {
    id,
    label,
    title,
    buttonLabel,
    weapon = false,
    open,
    groups,
    draft,
    mode,
    modeLabels,
    previewCount,
    emptyHint,
    button = $bindable(null),
    panel = $bindable(null),
    onbeforetoggle,
    ontoggle,
    onmode,
    ontag,
    onclear,
    onapply,
  }: Props = $props();
</script>

<div class="tag-filter" class:tag-filter--weapon={weapon}>
  <button
    type="button"
    class="wwn-select__btn"
    class:is-open={open}
    bind:this={button}
    popovertarget={id}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls={id}
    aria-label={buttonLabel}
  >
    <span class="wwn-select__value">{buttonLabel}</span>
    {@html iconSvg(Down)}
  </button>
</div>

<div
  class="tag-panel"
  {id}
  popover="auto"
  role="dialog"
  aria-label={label}
  bind:this={panel}
  {onbeforetoggle}
  {ontoggle}
>
  <div class="tag-panel__head">
    <span class="tag-panel__title">{title}</span>
    <fieldset class="tag-mode">
      <legend class="visually-hidden">{modeLabels.label}</legend>
      <button
        type="button"
        class="tag-mode__btn"
        class:is-active={mode === "all"}
        aria-pressed={mode === "all"}
        onclick={() => onmode("all")}
      >
        {modeLabels.all}
      </button>
      <button
        type="button"
        class="tag-mode__btn"
        class:is-active={mode === "any"}
        aria-pressed={mode === "any"}
        onclick={() => onmode("any")}
      >
        {modeLabels.any}
      </button>
    </fieldset>
  </div>
  <p class="tag-panel__mode-hint">
    {mode === "all" ? modeLabels.allHint : modeLabels.anyHint}
  </p>
  <div class="tag-panel__body">
    {#each groups as group (group.id)}
      <div class="tag-panel__group">
        <div class="tag-panel__group-title">{group.title}</div>
        <div class="tag-panel__chips">
          {#each group.tags as tag (tag.id)}
            <button
              type="button"
              class="tag-chip"
              aria-pressed={draft.includes(tag.id)}
              onclick={() => ontag(tag.id)}
            >
              {tag.label}<span class="tag-chip__count">{tag.count}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  <div class="tag-panel__preview" role="status" aria-live="polite">
    <span class:is-empty={emptyHint}>{formatTemplate(modeLabels.preview, { n: previewCount })}</span>
    {#if emptyHint}
      <span class="tag-panel__warning">{modeLabels.emptyHint}</span>
    {/if}
  </div>
  <div class="tag-panel__foot">
    <button
      type="button"
      class="btn btn--sm tag-panel__reset"
      disabled={draft.length === 0}
      onclick={onclear}
    >
      {modeLabels.clear}
    </button>
    <button type="button" class="btn btn--cyan btn--sm tag-panel__apply" onclick={onapply}>
      {modeLabels.apply}{draft.length ? ` (${draft.length})` : ""}
    </button>
  </div>
</div>
