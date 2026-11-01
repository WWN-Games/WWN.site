<script lang="ts">
  import type { ToastItem } from "../../shared/types";

  interface Props {
    items: ToastItem[];
    onclose: (id: number) => void;
  }

  const { items, onclose }: Props = $props();
</script>

<div class="toasts" aria-live="polite" aria-atomic="false">
  {#each items as toast (toast.id)}
    <div class="toast" class:toast--error={toast.type === "error"} class:toast--warn={toast.type === "warn"}>
      <span>{toast.message}</span>
      <button type="button" class="icon-btn" aria-label="Закрыть" onclick={() => onclose(toast.id)}>
        ×
      </button>
    </div>
  {/each}
</div>
