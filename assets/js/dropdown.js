/* ============================================================================
   WWN — кастомные выпадающие списки (Popover API)
   ----------------------------------------------------------------------------
   <select data-dropdown> получает кнопку в стиле сайта и меню в top layer.
   Кнопка — нативный инвокер (popovertarget): повторный клик закрывает список,
   Enter/Space работают сами, клик вне и Escape закрывают нативно.
   Если Popover API недоступен, остаётся обычный <select>.
   ============================================================================ */

import { $$ } from "./utils.js";

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const supportsPopover = () => typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

const currentText = (select) => select.options[select.selectedIndex]?.textContent ?? "";

function syncButton(btn, select) {
  if (!btn) return;
  const value = btn.querySelector(".wwn-select__value");
  if (value) value.textContent = currentText(select);
  btn.disabled = select.disabled;
}

function buildItems(menu, select) {
  menu.replaceChildren(
    ...Array.from(select.options, (opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "wwn-menu__item" + (opt.selected ? " is-selected" : "");
      item.dataset.value = opt.value;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(opt.selected));
      item.disabled = opt.disabled;

      const label = document.createElement("span");
      label.className = "wwn-menu__label";
      label.textContent = opt.textContent;
      item.append(label);
      return item;
    })
  );
}

function place(menu, btn, estimatedHeight = 0) {
  const rect = btn.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 180), Math.max(140, window.innerWidth - 16));
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const height = menu.getBoundingClientRect().height || estimatedHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < Math.min(height || 260, 240) && rect.top > spaceBelow;

  menu.style.left = `${Math.round(left)}px`;
  menu.style.width = `${Math.round(width)}px`;
  if (flip) {
    menu.style.top = "";
    menu.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
  } else {
    menu.style.bottom = "";
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  }
}

let selectSeq = 0;

function enhance(select) {
  if (select.dataset.wwnSelect) return;
  select.dataset.wwnSelect = "1";
  if (!select.id) select.id = `wwn-select-${++selectSeq}`;

  const wrap = document.createElement("div");
  wrap.className = "wwn-select";
  select.replaceWith(wrap);
  wrap.append(select);
  select.classList.add("wwn-select__native");
  select.tabIndex = -1;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wwn-select__btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  const label = select.getAttribute("aria-label") || select.getAttribute("title");
  if (label) btn.setAttribute("aria-label", label);
  btn.innerHTML = `<span class="wwn-select__value"></span>${ARROW}`;
  wrap.append(btn);

  const menu = document.createElement("div");
  menu.className = "wwn-menu";
  menu.popover = "auto";
  menu.setAttribute("role", "listbox");
  if (label) menu.setAttribute("aria-label", label);
  menu.id = `wwn-menu-${select.id}`;
  btn.setAttribute("aria-controls", menu.id);
  btn.setAttribute("popovertarget", menu.id);
  document.body.append(menu);

  syncButton(btn, select);
  select.addEventListener("change", () => syncButton(btn, select));

  let listeners = null;

  menu.addEventListener("beforetoggle", (event) => {
    if (event.newState !== "open") return;
    buildItems(menu, select);
    // До открытия высота меню неизвестна — берём оценку по числу пунктов,
    // точную позицию пересчитает rAF после открытия.
    place(menu, btn, select.options.length * 37 + 14);

    listeners?.abort();
    listeners = new AbortController();
    const reposition = () => {
      const rect = btn.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!visible) menu.hidePopover();
      else place(menu, btn);
    };
    window.addEventListener("scroll", reposition, { passive: true, signal: listeners.signal });
    window.addEventListener("resize", reposition, { signal: listeners.signal });

    requestAnimationFrame(() => {
      const item = menu.querySelector(".is-selected:not(:disabled)") || menu.querySelector(".wwn-menu__item:not(:disabled)");
      item?.focus({ preventScroll: true });
      item?.scrollIntoView({ block: "nearest" });
      place(menu, btn);
    });
  });

  menu.addEventListener("toggle", (event) => {
    const open = event.newState === "open";
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (!open) {
      listeners?.abort();
      listeners = null;
    }
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest(".wwn-menu__item");
    if (!item || item.disabled) return;
    if (select.value !== item.dataset.value) {
      select.value = item.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    syncButton(btn, select);
    menu.hidePopover();
    btn.focus({ preventScroll: true });
  });

  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll(".wwn-menu__item:not(:disabled)")];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const focus = (next) => {
      event.preventDefault();
      next.focus();
    };
    if (event.key === "ArrowDown") focus(items[index + 1] || items[0]);
    else if (event.key === "ArrowUp") focus(items[index - 1] || items[items.length - 1]);
    else if (event.key === "Home") focus(items[0]);
    else if (event.key === "End") focus(items[items.length - 1]);
    else if (event.key === "Escape") btn.focus({ preventScroll: true });
  });

  btn.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.showPopover();
    }
  });
}

/** Включить кастомные списки для всех <select data-dropdown> внутри root. */
export function initDropdowns(root = document) {
  if (!supportsPopover()) return;
  $$("select[data-dropdown]", root).forEach(enhance);
}

/** Обновить подпись и закрыть список (например, при скрытии селекта). */
export function refreshDropdown(select) {
  const wrap = select.closest(".wwn-select");
  syncButton(wrap?.querySelector(".wwn-select__btn") ?? null, select);
  if (select.classList.contains("is-hidden")) {
    document.getElementById(`wwn-menu-${select.id}`)?.hidePopover();
  }
}
