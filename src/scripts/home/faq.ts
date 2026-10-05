/* ============================================================================
   WWN — FAQ главной: аккордеон с корректной высотой и инертно-скрытыми
   ответами. Открыт всегда максимум один пункт; высота пересчитывается
   при смене шрифтов и ресайзе. Повторная привязка — по dataset-флагу.
   ============================================================================ */

import { debounce } from "@/lib/utils";

let controller: AbortController | null = null;

function setOpen(item: HTMLElement, open: boolean): void {
  const question = item.querySelector<HTMLButtonElement>(".faq__q");
  const answer = item.querySelector<HTMLElement>(".faq__a");
  if (!question || !answer) return;
  item.classList.toggle("is-open", open);
  question.setAttribute("aria-expanded", String(open));
  answer.inert = !open;
  answer.setAttribute("aria-hidden", String(!open));
  answer.style.maxHeight = open ? `${answer.scrollHeight}px` : "";
}

function syncHeights(root: HTMLElement): void {
  for (const answer of root.querySelectorAll<HTMLElement>(".faq__item.is-open .faq__a")) {
    answer.style.maxHeight = `${answer.scrollHeight}px`;
  }
}

function initFaq(): void {
  const faq = document.querySelector<HTMLElement>(".faq");
  if (!faq || faq.dataset.faqBound === "true") return;
  faq.dataset.faqBound = "true";

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  const items = [...faq.querySelectorAll<HTMLElement>(".faq__item")];
  if (!items.length) return;

  for (const item of items) {
    const question = item.querySelector<HTMLButtonElement>(".faq__q");
    if (!question) continue;
    setOpen(item, false);
    question.addEventListener(
      "click",
      () => {
        const wasOpen = item.classList.contains("is-open");
        for (const other of items) {
          if (other !== item) setOpen(other, false);
        }
        setOpen(item, !wasOpen);
      },
      { signal },
    );
  }

  const sync = (): void => syncHeights(faq);
  window.addEventListener("resize", debounce(sync, 150), { signal });
  document.fonts.ready
    .then(() => {
      if (!signal.aborted) sync();
    })
    .catch(() => {});
}

document.addEventListener("astro:before-swap", () => {
  controller?.abort();
  controller = null;
});

document.addEventListener("astro:page-load", initFaq);
initFaq();
