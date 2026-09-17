/* ============================================================================
   WWN — база данных (database.html): фракции, юниты, строения.
   Страница не зависит от вики: своего сайдбара и поиска здесь нет.
   Фильтры: поиск, фракция, тип, сортировка (стилизованные выпадающие списки).
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, getLang, initLangSwitch, onLangChange, registerDictLoaders, t } from "./i18n.js";
import { $, $$, abs, collator, debounce, emptyBlock, escapeHtml, foldSearch, loc, locObj, nextFocusIndex, safeColor } from "./utils.js";
import { initHeader, initReveal, initYear, unreveal } from "./ui.js";

registerDictLoaders({
  ru: () => import("./i18n/database.ru.js"),
  en: () => import("./i18n/database.en.js")
});

/* ----------------------------------------------------------------------------
   Кастомные выпадающие списки (Popover API): <select data-dropdown> получает
   кнопку в стиле сайта и меню в top layer. Кнопка — нативный инвокер
   (popovertarget): повторный клик закрывает, Enter/Space работают сами,
   клик вне и Escape закрывают нативно.
   ---------------------------------------------------------------------------- */

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const currentText = (select) => select.options[select.selectedIndex]?.textContent ?? "";

function syncButton(btn, select) {
  if (!btn) return;
  const text = currentText(select);
  const value = btn.querySelector(".wwn-select__value");
  if (value) value.textContent = text;
  const label = select.dataset.wwnLabel;
  if (label) btn.setAttribute("aria-label", text && text !== label ? `${label}: ${text}` : label);
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

function placeMenu(menu, btn, estimatedHeight = 0, minWidth = 180) {
  const rect = btn.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, minWidth), Math.max(140, window.innerWidth - 16));
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
  if (label) select.dataset.wwnLabel = label;
  select.setAttribute("aria-hidden", "true");
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
    placeMenu(menu, btn, select.options.length * 37 + 14);

    listeners?.abort();
    listeners = new AbortController();
    const reposition = () => {
      const rect = btn.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!visible) menu.hidePopover();
      else placeMenu(menu, btn);
    };
    window.addEventListener("scroll", reposition, { passive: true, signal: listeners.signal });
    window.addEventListener("resize", reposition, { signal: listeners.signal });

    requestAnimationFrame(() => {
      const item = menu.querySelector(".is-selected:not(:disabled)") || menu.querySelector(".wwn-menu__item:not(:disabled)");
      item?.focus({ preventScroll: true });
      item?.scrollIntoView({ block: "nearest" });
      placeMenu(menu, btn);
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
    if (event.key === "Escape") {
      btn.focus({ preventScroll: true });
      return;
    }
    const items = [...menu.querySelectorAll(".wwn-menu__item:not(:disabled)")];
    const next = nextFocusIndex(items, event);
    if (next === -1) return;
    event.preventDefault();
    items[next].focus();
  });

  btn.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      menu.showPopover();
    }
  });
}

/** Включить кастомные списки для всех <select data-dropdown> внутри root. */
function initDropdowns(root = document) {
  $$("select[data-dropdown]", root).forEach(enhance);
}

/** Обновить подпись и закрыть список (например, при скрытии селекта). */
function refreshDropdown(select) {
  const wrap = select.closest(".wwn-select");
  syncButton(wrap?.querySelector(".wwn-select__btn") ?? null, select);
  if (select.classList.contains("is-hidden")) {
    document.getElementById(`wwn-menu-${select.id}`)?.hidePopover();
  }
}

const state = {
  lang: getLang(),
  tab: (location.hash || "#factions").replace("#", ""),
  search: "",
  faction: "all",
  type: "all",
  tags: new Set(),
  sort: "name"
};
if (!["factions", "units", "buildings"].includes(state.tab)) state.tab = "factions";

const data = { factions: [], units: [], buildings: [], tags: [] };

const tagMap = new Map();
const factionMap = new Map();
const factionCounts = new Map();

const list = (obj, lang) => {
  const value = locObj(obj, lang, []);
  return Array.isArray(value) ? value : [value];
};
const typeLabel = (type, lang) => {
  const label = t(`database.type.${type}`, lang);
  return label === `database.type.${type}` ? type : label;
};

const tagLabel = (id, lang) => {
  const tag = tagMap.get(id);
  return tag ? loc(tag.name, lang) || id : id;
};
const factionColor = (id) => safeColor(factionMap.get(id)?.color, "#29b8ff");
const factionName = (id, lang) => {
  const faction = factionMap.get(id);
  return faction ? loc(faction.name, lang) : id;
};

/* карточки зависят только от id и языка — собираем HTML один раз */
const cardCache = new Map();

/* Тяжёлое построение сетки уводим за кадр: клик и ввод не ждут рендер. */
let renderToken = 0;
const nextFrame = () => new Promise((resolve) => {
  if (globalThis.scheduler?.yield) {
    scheduler.yield().then(resolve, resolve);
    return;
  }
  requestAnimationFrame(() => setTimeout(resolve, 0));
});

function scheduleRender() {
  const token = ++renderToken;
  nextFrame().then(() => {
    if (token === renderToken) render();
  });
}
async function loadAll() {
  const names = ["factions", "units", "buildings", "tags"];
  const results = await Promise.allSettled(
    names.map((name) =>
      fetch(abs(`data/${name}.json?v=${WWN_CONFIG.version}`)).then((res) => {
        if (!res.ok) throw new Error(name);
        return res.json();
      })
    )
  );
  const [factions, units, buildings, tags] = results.map((result) =>
    result.status === "fulfilled" ? result.value : null
  );
  data.factions = factions?.factions || [];
  data.units = units?.units || [];
  data.buildings = buildings?.buildings || [];
  data.tags = tags?.tags || [];
}

function buildLookups() {
  tagMap.clear();
  factionMap.clear();
  factionCounts.clear();
  data.tags.forEach((tag) => tagMap.set(tag.id, tag));
  data.factions.forEach((faction) => factionMap.set(faction.id, faction));
  data.factions.forEach((faction) => factionCounts.set(faction.id, { units: 0, buildings: 0 }));
  data.units.forEach((unit) => {
    const counts = factionCounts.get(unit.faction);
    if (counts) counts.units += 1;
  });
  data.buildings.forEach((building) => {
    const counts = factionCounts.get(building.faction);
    if (counts) counts.buildings += 1;
  });
}
/* На вкладке «Фракции» списков нет; на «Юнитах» и «Строениях» — все. */
const tabSource = () => state.tab === "units" ? data.units : state.tab === "buildings" ? data.buildings : [];
const tabTypes = () => [...new Set(tabSource().map((item) => item.type).filter(Boolean))];
const tabTagIds = () => {
  const used = new Set();
  tabSource().forEach((item) => (item.tags || []).forEach((id) => used.add(id)));
  return [...used];
};

function updateFilterVisibility() {
  const showFilters = state.tab !== "factions";
  const hasTypes = tabTypes().length > 0;
  const hasTags = tabTagIds().length > 0;
  const visibility = {
    databaseFaction: showFilters,
    databaseType: showFilters && hasTypes,
    databaseSort: showFilters
  };

  Object.entries(visibility).forEach(([id, visible]) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.classList.toggle("is-hidden", !visible);
    select.closest(".wwn-select")?.classList.toggle("is-hidden", !visible);
    if (!visible) refreshDropdown(select);
  });

  const tagHost = $("#tagFilter");
  if (tagHost) {
    const visible = showFilters && hasTags;
    tagHost.classList.toggle("is-hidden", !visible);
    if (!visible) closeTagPanel();
  }
}

function bindSelect(select, apply) {
  if (!select || select.dataset.bound) return;
  select.dataset.bound = "1";
  select.addEventListener("change", () => {
    apply(select.value);
    scheduleRender();
  });
}

function fillSelect(select, options, currentValue, allLabelKey) {
  if (!select) return;
  select.replaceChildren();

  if (allLabelKey) {
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = t(allLabelKey, state.lang);
    select.append(all);
  }

  select.append(
    ...options.map((option) => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      return el;
    })
  );

  select.value = currentValue;
  refreshDropdown(select);
}

function buildFactionFilter() {
  const select = $("#databaseFaction");
  if (!select) return;
  bindSelect(select, (value) => { state.faction = value; });
  fillSelect(
    select,
    data.factions.map((faction) => ({ value: faction.id, label: loc(faction.name, state.lang) })),
    state.faction,
    "database.filter.all"
  );
}

let typeFilterSignature = "";

function buildTypeFilter() {
  const select = $("#databaseType");
  if (!select) return;
  bindSelect(select, (value) => { state.type = value; });
  const types = tabTypes();

  if (state.type !== "all" && !types.includes(state.type)) state.type = "all";

  // список опций меняется только вместе с вкладкой/языком — не перестраиваем зря
  const signature = `${state.lang}|${state.tab}|${state.type}|${types.join(",")}`;
  if (signature === typeFilterSignature) return;
  typeFilterSignature = signature;

  if (!types.length) {
    select.replaceChildren();
    refreshDropdown(select);
    return;
  }

  fillSelect(
    select,
    types.map((type) => ({ value: type, label: typeLabel(type, state.lang) })),
    state.type,
    "database.filter.all"
  );
}

/* Порядок групп тегов в списке: уровень, класс, движение, прочее. */
const TAG_GROUP_ORDER = { tier: 0, class: 1, movement: 2, mod: 3 };

let tagPanel = null;
let tagButton = null;
let tagPanelOpen = false;
let tagDraft = new Set();

const tagGroupTitle = (group) => {
  const label = t(`database.tagGroup.${group}`, state.lang);
  return label === `database.tagGroup.${group}` ? group : label;
};

function tagOptions() {
  return tabTagIds()
    .map((id) => {
      const tag = tagMap.get(id);
      return { id, label: tag ? loc(tag.name, state.lang) || id : id, group: tag?.group || "mod" };
    })
    .sort((a, b) =>
      (TAG_GROUP_ORDER[a.group] ?? 9) - (TAG_GROUP_ORDER[b.group] ?? 9) ||
      collator(state.lang).compare(a.label, b.label)
    );
}

function updateTagPanelFooter() {
  const apply = tagPanel?.querySelector(".tag-panel__apply");
  if (apply) {
    apply.textContent = tagDraft.size
      ? `${t("database.tag.apply", state.lang)} (${tagDraft.size})`
      : t("database.tag.apply", state.lang);
  }
  const reset = tagPanel?.querySelector(".tag-panel__reset");
  if (reset) reset.disabled = !tagDraft.size;
}

function applyTagPanelLabels() {
  if (!tagPanel) return;
  tagPanel.setAttribute("aria-label", t("database.filter.tag", state.lang));
  tagPanel.querySelector(".tag-panel__title").textContent = t("database.tag.panelTitle", state.lang);
  tagPanel.querySelector(".tag-panel__reset").textContent = t("database.tag.clear", state.lang);
  updateTagPanelFooter();
}

function renderTagPanel() {
  if (!tagPanel) return;
  const options = tagOptions();
  for (const id of [...tagDraft]) {
    if (!options.some((tag) => tag.id === id)) tagDraft.delete(id);
  }

  const groups = Object.groupBy(options, (tag) => tag.group);

  const body = tagPanel.querySelector(".tag-panel__body");
  body.replaceChildren(
    ...Object.keys(groups)
      .sort((a, b) => (TAG_GROUP_ORDER[a] ?? 9) - (TAG_GROUP_ORDER[b] ?? 9))
      .map((group) => {
        const section = document.createElement("div");
        section.className = "tag-panel__group";
        const title = document.createElement("div");
        title.className = "tag-panel__group-title";
        title.textContent = tagGroupTitle(group);
        const chips = document.createElement("div");
        chips.className = "tag-panel__chips";
        groups[group].forEach((tag) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "tag-chip";
          chip.dataset.tag = tag.id;
          chip.setAttribute("aria-pressed", String(tagDraft.has(tag.id)));
          chip.textContent = tag.label;
          chips.append(chip);
        });
        section.append(title, chips);
        return section;
      })
  );

  updateTagPanelFooter();
}

function updateTagButton() {
  if (!tagButton) return;
  const label = t("database.filter.tag", state.lang);
  const text = state.tags.size ? `${label}: ${state.tags.size}` : label;
  const value = tagButton.querySelector(".wwn-select__value");
  if (value) value.textContent = text;
  tagButton.setAttribute("aria-label", text);
}

function closeTagPanel() {
  if (!tagPanelOpen) return;
  tagPanelOpen = false;
  tagPanel.hidePopover();
}

function initTagFilter() {
  if (tagPanel) return;
  const host = $("#tagFilter");
  if (!host) return;

  host.classList.add("wwn-select");
  tagButton = document.createElement("button");
  tagButton.type = "button";
  tagButton.className = "wwn-select__btn";
  tagButton.setAttribute("aria-haspopup", "dialog");
  tagButton.setAttribute("aria-expanded", "false");
  tagButton.innerHTML = `<span class="wwn-select__value"></span>${ARROW}`;
  host.append(tagButton);

  tagPanel = document.createElement("div");
  tagPanel.className = "tag-panel";
  tagPanel.id = "tagPanel";
  tagPanel.popover = "auto";
  tagPanel.setAttribute("aria-label", t("database.filter.tag", state.lang));
  tagPanel.innerHTML = `
    <div class="tag-panel__head">
      <span class="tag-panel__title"></span>
    </div>
    <div class="tag-panel__body"></div>
    <div class="tag-panel__foot">
      <button type="button" class="btn btn--sm tag-panel__reset"></button>
      <button type="button" class="btn btn--cyan btn--sm tag-panel__apply"></button>
    </div>`;
  applyTagPanelLabels();
  document.body.append(tagPanel);
  tagButton.setAttribute("popovertarget", tagPanel.id);
  tagButton.setAttribute("aria-controls", tagPanel.id);

  let listeners = null;
  const panelWidth = () => Math.min(360, window.innerWidth - 24);
  const reposition = () => {
    const rect = tagButton.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) tagPanel.hidePopover();
    else placeMenu(tagPanel, tagButton, 420, panelWidth());
  };

  tagPanel.addEventListener("beforetoggle", (event) => {
    if (event.newState !== "open") return;
    tagDraft = new Set(state.tags);
    renderTagPanel();
    placeMenu(tagPanel, tagButton, 420, panelWidth());
    listeners?.abort();
    listeners = new AbortController();
    window.addEventListener("scroll", reposition, { passive: true, signal: listeners.signal });
    window.addEventListener("resize", reposition, { signal: listeners.signal });
    requestAnimationFrame(() => {
      placeMenu(tagPanel, tagButton, 420, panelWidth());
      tagPanel.querySelector(".tag-chip")?.focus({ preventScroll: true });
    });
  });

  tagPanel.addEventListener("toggle", (event) => {
    const open = event.newState === "open";
    tagPanelOpen = open;
    tagButton.classList.toggle("is-open", open);
    tagButton.setAttribute("aria-expanded", String(open));
    if (!open) {
      listeners?.abort();
      listeners = null;
    }
  });

  tagPanel.addEventListener("click", (event) => {
    const chip = event.target.closest(".tag-chip");
    if (chip) {
      const id = chip.dataset.tag;
      if (tagDraft.has(id)) tagDraft.delete(id);
      else tagDraft.add(id);
      chip.setAttribute("aria-pressed", String(tagDraft.has(id)));
      updateTagPanelFooter();
      return;
    }
    if (event.target.closest(".tag-panel__reset")) {
      tagDraft.clear();
      state.tags.clear();
      updateTagButton();
      renderTagPanel();
      scheduleRender();
      return;
    }
    if (event.target.closest(".tag-panel__apply")) {
      state.tags = new Set(tagDraft);
      updateTagButton();
      scheduleRender();
      closeTagPanel();
    }
  });
}

function syncTagFilter() {
  if (!tagPanel) initTagFilter();
  // применённые теги могли исчезнуть при смене вкладки — чистим
  const available = new Set(tabTagIds());
  for (const id of state.tags) {
    if (!available.has(id)) state.tags.delete(id);
  }
  applyTagPanelLabels();
  if (tagPanelOpen) renderTagPanel();
  updateTagButton();
}

function buildSortFilter() {
  const select = $("#databaseSort");
  if (!select) return;
  bindSelect(select, (value) => { state.sort = value; });
  fillSelect(
    select,
    ["name", "cost", "hp", "shield", "dps", "speed", "range"].map((key) => ({
      value: key,
      label: t(`database.sort.${key}`, state.lang)
    })),
    state.sort,
    null
  );
}
function initTabs() {
  const tabs = $$("#databaseTabs .tab");
  const activate = (tab, focus = false) => {
    if (tab === state.tab && !focus) return;
    state.tab = tab;
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && focus) btn.focus();
    });
    $("#databaseGrid")?.setAttribute("aria-labelledby", `tab-${tab}`);
    try { history.replaceState(null, "", `#${tab}`); } catch {}
    buildTypeFilter();
    syncTagFilter();
    updateFilterVisibility();
    scheduleRender();
  };
  tabs.forEach((btn) => {
    // подсветка всегда соответствует текущей вкладке (в т.ч. после перезагрузки с #units)
    btn.id = `tab-${btn.dataset.tab}`;
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });

  // навигация по табам стрелками (паттерн WAI-ARIA tabs)
  $("#databaseTabs")?.addEventListener("keydown", (event) => {
    if (!tabs.includes(document.activeElement)) return;
    const next = nextFocusIndex(tabs, event, { axis: "x" });
    if (next === -1) return;
    event.preventDefault();
    activate(tabs[next].dataset.tab, true);
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (["factions", "units", "buildings"].includes(hash) && hash !== state.tab) activate(hash);
  });
}
const chip = (text, className = "") => `<span class="chip ${className}">${escapeHtml(text)}</span>`;

/** Шкала полос — логарифмическая с устойчивыми опорами:
 *  lo — 5-й процентиль, hi — максимум, а при явном выбросе (max > p95×3,
 *  как range = 999999) — 95-й процентиль. Ненулевые значения получают
 *  минимум 10% полосы, топ не «залипает»: в 100% упираются единицы. */
const MIN_BAR = 10;

const scale = { hp: null, shield: null, dps: null, speed: null, range: null };
/** Показываем полосу только если характеристика есть хотя бы у кого-то
 *  (например, у строений нет скорости — полосу не рисуем). Считается один
 *  раз по всей базе, чтобы раскладка карточек не менялась от фильтров. */
const hasStat = { hp: false, shield: false, dps: false, speed: false, range: false };

const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function computeHasStat() {
  const all = [...data.units, ...data.buildings];
  Object.keys(hasStat).forEach((key) => {
    hasStat[key] = all.some((item) => typeof item[key] === "number" && item[key] > 0);
  });
}

/** Шкала полос — по текущей выборке: когда список сужен фильтрами, поиском
 *  или вкладкой, полосы сравнивают только оставшиеся карточки. */
function computeScale(items) {
  Object.keys(scale).forEach((key) => {
    const values = items
      .map((item) => item[key])
      .filter((value) => typeof value === "number" && value > 0)
      .sort((a, b) => a - b);
    if (!values.length) {
      scale[key] = null;
      return;
    }
    const at = (q) => values[Math.min(values.length - 1, Math.round(q * (values.length - 1)))];
    const lo = at(0.05);
    const p95 = at(0.95);
    const max = values[values.length - 1];
    scale[key] = { lo, hi: max > p95 * 3 ? p95 : max, median: median(values) };
  });
}

/* Подпись шкалы: меняется — сбрасываем кэш собранных карточек. */
let scaleToken = "";
const scaleSignature = () =>
  Object.keys(scale)
    .map((key) => {
      const s = scale[key];
      return s ? `${key}:${s.lo}/${s.hi}/${s.median}` : `${key}:`;
    })
    .join("|");

const formatValue = (value) => {
  if (!Number.isFinite(value) || value === 0) return 0;
  const magnitude = Math.abs(value);
  if (magnitude < 10) return Math.round(value * 100) / 100;
  if (magnitude < 1000) return Math.round(value * 10) / 10;
  return Math.round(value);
};

const barPercent = (value, key) => {
  const s = scale[key];
  if (!(value > 0) || !s) return 0;
  const span = Math.log(s.hi / s.lo);
  if (!(span > 0)) return 100;
  const t = Math.log(value / s.lo) / span;
  return Math.max(MIN_BAR, Math.min(100, Math.round(MIN_BAR + (100 - MIN_BAR) * t)));
};

const statBar = (key, label, value, color) => {
  const safe = Number.isFinite(value) ? value : 0;
  const percent = barPercent(safe, key);
  const medianPercent = barPercent(scale[key]?.median ?? 0, key);
  return `<div class="statbar" style="--faction-color:${color};--median:${medianPercent}%">
    <span class="statbar__label">${escapeHtml(label)}</span>
    <span class="statbar__track"><span class="statbar__fill" style="--w:${percent}%"></span></span>
    <span class="statbar__val">${formatValue(safe)}</span>
  </div>`;
};

function unitCardHtml(item) {
  const lang = state.lang;
  const cacheKey = `${lang}|u|${item.id}`;
  const cached = cardCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const color = factionColor(item.faction);
  const name = loc(item.name, lang);
  // картинка по умолчанию — по id; item.image переопределяет, "" скрывает
  const imageSrc = item.image === "" ? "" : item.image || `assets/img/database/${item.id}.avif`;
  const initials = name.slice(0, 2).toUpperCase();
  const image = imageSrc
    ? `<img src="${escapeHtml(abs(imageSrc))}" alt="${escapeHtml(name)}" data-initials="${escapeHtml(initials)}" loading="lazy" decoding="async">`
    : `<span>${escapeHtml(initials)}</span>`;

  const chips = [
    chip(factionName(item.faction, lang), "chip--faction"),
    item.type ? chip(typeLabel(item.type, lang)) : "",
    ...(item.tags || []).map((id) => chip(tagLabel(id, lang), "chip--tag")),
    item.role ? chip(loc(item.role, lang)) : "",
    item.draft ? chip(t("database.draft", lang), "chip--draft") : ""
  ].join("");

  // полосы показываются: нет урона — честный 0, нет характеристики у вида — полосы нет
  const barDefs = [
    ["hp", "database.hp"],
    ["shield", "database.shield"],
    ["dps", "database.dps"],
    ["speed", "database.speed"],
    ["range", "database.range"]
  ];
  const bars = barDefs
    .filter(([key]) => hasStat[key])
    .map(([key, label]) => statBar(key, t(label, lang), item[key] || 0, color))
    .join("");

  const strong = list(item.strongVs, lang);
  const weak = list(item.weakVs, lang);
  const matchups = strong.length || weak.length
    ? `<div class="unit-card__lists">
         ${strong.length ? `<div><b>${t("database.strong", lang)}:</b> <span class="vs-strong">${escapeHtml(strong.join(", "))}</span></div>` : ""}
         ${weak.length ? `<div><b>${t("database.weak", lang)}:</b> <span class="vs-weak">${escapeHtml(weak.join(", "))}</span></div>` : ""}
       </div>`
    : "";

  const costs = item.cost || item.buildTime
    ? `<div class="unit-card__sub">
         ${item.cost ? chip(`${t("database.cost", lang)}: ${item.cost}`) : ""}
         ${item.buildTime ? chip(`${t("database.buildTime", lang)}: ${item.buildTime}${t("database.seconds", lang)} (1x)`) : ""}
       </div>`
    : "";

  const html =
    `<article class="unit-card" data-reveal style="--faction-color:${color}">
       <div class="unit-card__top">
         <div class="unit-card__img">${image}</div>
         <div class="unit-card__name">${escapeHtml(name)}</div>
       </div>
       <div class="unit-card__tags">${chips}</div>
       ${costs}
       ${item.desc ? `<p class="unit-card__desc">${escapeHtml(loc(item.desc, lang))}</p>` : ""}
       ${bars ? `<div class="statbars">${bars}</div>` : ""}
       ${matchups}
     </article>`;
  cardCache.set(cacheKey, html);
  return html;
}

function factionCardHtml(faction, counts) {
  const lang = state.lang;
  const cacheKey = `${lang}|f|${faction.id}`;
  const cached = cardCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const color = safeColor(faction.color, "#29b8ff");
  const name = loc(faction.name, lang);
  const emblem = faction.emblem
    ? `<img src="${escapeHtml(abs(faction.emblem))}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">`
    : `<span style="color:${color};font-family:var(--font-display)">${escapeHtml(name.slice(0, 2))}</span>`;
  const strengths = list(faction.strengths, lang);
  const weaknesses = list(faction.weaknesses, lang);
  const counters = counts
    ? `<div class="unit-card__sub" style="margin-top:8px">
         ${chip(`${t("database.tab.units", lang)}: ${counts.units}`)}
         ${chip(`${t("database.tab.buildings", lang)}: ${counts.buildings}`)}
       </div>`
    : "";

  const block = (title, value) =>
    value ? `<div class="faction-block"><h5>${escapeHtml(title)}</h5><p>${escapeHtml(value)}</p></div>` : "";
  const blockList = (title, items) =>
    items.length
      ? `<div class="faction-block"><h5>${escapeHtml(title)}</h5><ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`
      : "";

  const html =
    `<article class="faction-card" data-reveal style="--faction-color:${color}">
       <div class="faction-card__head">
         <div class="faction-card__emblem">${emblem}</div>
         <div>
           <div class="faction-card__name">${escapeHtml(name)}</div>
           <div class="faction-card__motto">${escapeHtml(loc(faction.motto, lang))}</div>
           ${counters}
         </div>
       </div>
       ${faction.desc ? `<p class="faction-card__desc">${escapeHtml(loc(faction.desc, lang))}</p>` : ""}
       <div class="faction-card__blocks">
         ${block(t("database.faction.playstyle", lang), loc(faction.playstyle, lang))}
         ${block(t("database.faction.specialty", lang), loc(faction.specialty, lang))}
         ${blockList(t("database.strong", lang), strengths)}
         ${blockList(t("database.weak", lang), weaknesses)}
       </div>
       ${faction.lore ? `<a class="btn btn--sm faction-card__link" href="wiki/article.html?p=${faction.lore}">${escapeHtml(t("database.openLore", lang))}</a>` : ""}
     </article>`;
  cardCache.set(cacheKey, html);
  return html;
}
const matches = (item, lang) => {
  if (!state.search) return true;
  const tags = (item.tags || []).map((id) => `${id} ${tagLabel(id, lang)}`).join(" ");
  const haystack = foldSearch(`${loc(item.name, lang)} ${loc(item.role, lang)} ${loc(item.desc, lang)} ${tags}`);
  return haystack.includes(state.search);
};

function render() {
  const grid = $("#databaseGrid");
  const count = $("#databaseCount");
  if (!grid) return;
  const lang = state.lang;
  grid.dataset.mode = state.tab;

  let items = [];
  let html = "";

  if (state.tab === "factions") {
    items = data.factions.filter((faction) => matches(faction, lang));
    html = items
      .map((faction) => factionCardHtml(faction, factionCounts.get(faction.id) || { units: 0, buildings: 0 }))
      .join("");
  } else {
    const source = state.tab === "units" ? data.units : data.buildings;
    items = source
      .filter((item) => {
        if (!matches(item, lang)) return false;
        if (state.faction !== "all" && item.faction !== state.faction) return false;
        if (state.type !== "all" && item.type !== state.type) return false;
        if (state.tags.size) {
          const itemTags = item.tags || [];
          for (const id of state.tags) {
            if (!itemTags.includes(id)) return false;
          }
        }
        return true;
      })
      .sort((a, b) =>
        state.sort === "name"
          ? collator(lang).compare(loc(a.name, lang), loc(b.name, lang))
          : (b[state.sort] || 0) - (a[state.sort] || 0)
      );
    // шкала полос — по текущей выборке; при смене выборки кэш карточек сбрасываем
    computeScale(items);
    const signature = scaleSignature();
    if (signature !== scaleToken) {
      scaleToken = signature;
      cardCache.clear();
    }
    html = items.map((item) => unitCardHtml(item)).join("");
  }

  grid.classList.remove("is-shown");
  unreveal(grid);
  if (!items.length) {
    grid.replaceChildren(emptyBlock(t("database.empty", lang)));
  } else {
    grid.innerHTML = html;
    initReveal(grid);
    // одна общая анимация полос вместо записи ширины в ~900 элементов
    requestAnimationFrame(() => grid.classList.add("is-shown"));
  }
  if (count) count.textContent = t("database.count", lang, { n: items.length });
}

/** Если картинки нет — показываем инициалы вместо битой иконки. */
function initImageFallback() {
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.initials) return;
      const span = document.createElement("span");
      span.textContent = img.dataset.initials;
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", img.alt || img.dataset.initials);
      img.replaceWith(span);
    },
    true
  );
}
function renderPage(lang) {
  state.lang = lang;
  document.title = t("meta.title.database", lang);

  if (!dataReady) {
    const grid = $("#databaseGrid");
    if (grid) grid.replaceChildren(emptyBlock(t("database.noData", lang)));
    return;
  }

  buildFactionFilter();
  buildTypeFilter();
  syncTagFilter();
  buildSortFilter();
  updateFilterVisibility();
  scheduleRender();
}

let dataReady = false;

async function boot() {
  initHeader();
  initYear();
  initLangSwitch();

  // данные грузятся параллельно словарю — рендер всё равно ждёт оба
  const dataPromise = loadAll();

  await bootI18n();
  initDropdowns();
  initTabs();
  initImageFallback();

  const debouncedRender = debounce(scheduleRender, 140);
  $("#databaseSearch")?.addEventListener("input", (event) => {
    state.search = foldSearch(event.target.value.trim());
    debouncedRender();
  });

  onLangChange(() => renderPage(getLang()));

  try {
    await dataPromise;
    buildLookups();
    computeHasStat();
    dataReady = data.factions.length > 0 || data.units.length > 0 || data.buildings.length > 0;
  } catch {
    // при неожиданной ошибке шапка, меню и язык всё равно работают
  }

  renderPage(getLang());
  initReveal();
}

boot();
