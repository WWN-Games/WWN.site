/* ============================================================================
   WWN — FAQ главной: аккордеон с корректной высотой и инертно-скрытыми
   ответами (без max-height-скачков при смене языка/шрифтов).
   ============================================================================ */

import { $, $$ } from "../utils.js";

function setOpen(item, open) {
  const question = $(".faq__q", item);
  const answer = $(".faq__a", item);
  if (!question || !answer) return;
  item.classList.toggle("is-open", open);
  question.setAttribute("aria-expanded", String(open));
  answer.inert = !open;
  answer.setAttribute("aria-hidden", String(!open));
  answer.style.maxHeight = open ? `${answer.scrollHeight}px` : "";
}

export function syncFaqHeights() {
  $$(".faq__item.is-open .faq__a").forEach((answer) => {
    answer.style.maxHeight = `${answer.scrollHeight}px`;
  });
}

export function initFaq() {
  const items = $$(".faq__item");
  if (!items.length) return;

  items.forEach((item) => {
    const question = $(".faq__q", item);
    if (!question) return;
    setOpen(item, false);
    question.addEventListener("click", () => {
      const wasOpen = item.classList.contains("is-open");
      items.forEach((other) => {
        if (other !== item) setOpen(other, false);
      });
      setOpen(item, !wasOpen);
    });
  });

  document.fonts.ready.then(syncFaqHeights).catch(() => {});
}
