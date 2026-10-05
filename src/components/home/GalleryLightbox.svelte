<script lang="ts">
  import { Close, Left, Right } from "@icon-park/svg";

import { iconSvg } from "@/components/ui/icon";

  /* ============================================================================
     WWN — лайтбокс галереи главной: остров Svelte 5 (только лайтбокс).
     Клик по плиткам делегирован с документа ([data-gallery-index]); клавиши,
     свайпы, прелоад соседей и возврат фокуса — как в legacy gallery.js.
     ============================================================================ */

interface GalleryItem {
  src: string;
  caption: string;
}

interface Labels {
  dialog: string;
  close: string;
  prev: string;
  next: string;
}

let { items, labels }: { items: GalleryItem[]; labels: Labels } = $props();

let dialog = $state<HTMLDialogElement | null>(null);
let index = $state(0);
let current = $state<GalleryItem | null>(null);
let lastFocus: HTMLElement | null = null;

const many = $derived(items.length > 1);

function preloadNeighbors(): void {
  if (items.length < 2) return;
  for (const offset of [1, -1]) {
    const neighbor = items[(index + offset + items.length) % items.length];
    if (neighbor) new Image().src = neighbor.src;
  }
}

function open(next: number): void {
  if (!items.length) return;
  index = (next + items.length) % items.length;
  const item = items[index];
  if (!item) return;
  current = item;
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (dialog && !dialog.open) dialog.showModal();
  preloadNeighbors();
}

function step(direction: number): void {
  open(index + direction);
}

function handleClose(): void {
  current = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

/* Слушатели самого диалога: стрелки, клик по фону, свайпы. */
$effect(() => {
  const element = dialog;
  if (!element) return;

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === element) element.close();
  };

  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  };

  element.addEventListener("keydown", onKeydown);
  element.addEventListener("click", onBackdropClick);
  element.addEventListener("pointerdown", onPointerDown, { passive: true });
  element.addEventListener("pointerup", onPointerUp);
  return () => {
    element.removeEventListener("keydown", onKeydown);
    element.removeEventListener("click", onBackdropClick);
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointerup", onPointerUp);
  };
});

/* Делегированные клики и Enter/Space по плиткам галереи. */
$effect(() => {
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>("[data-gallery-index]");
    if (!trigger) return;
    const value = Number(trigger.dataset.galleryIndex);
    if (!Number.isFinite(value)) return;
    event.preventDefault();
    open(value);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("[data-gallery-index]")) return;
    if (target instanceof HTMLButtonElement) return;
    event.preventDefault();
    const value = Number(target.dataset.galleryIndex);
    if (Number.isFinite(value)) open(value);
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  return () => {
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
  };
});
</script>

<dialog
  class="lightbox"
  id="lightbox"
  aria-label={labels.dialog}
  bind:this={dialog}
  onclose={handleClose}
>
  <button
    class="lightbox__close"
    id="lbClose"
    type="button"
    aria-label={labels.close}
    onclick={() => dialog?.close()}
  >
    {@html iconSvg(Close)}
  </button>
  <button
    class="lightbox__prev"
    id="lbPrev"
    type="button"
    aria-label={labels.prev}
    hidden={!many}
    onclick={() => step(-1)}
  >
    {@html iconSvg(Left)}
  </button>
  <button
    class="lightbox__next"
    id="lbNext"
    type="button"
    aria-label={labels.next}
    hidden={!many}
    onclick={() => step(1)}
  >
    {@html iconSvg(Right)}
  </button>
  <div class="lightbox__body">
    <img id="lbImg" src={current?.src} alt={current?.caption ?? ""}>
    <p class="lightbox__cap" id="lbCap">{current?.caption ?? ""}</p>
  </div>
</dialog>
