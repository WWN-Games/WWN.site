/* ============================================================================
   WWN — база данных (database.html): фракции, юниты, строения.
   Страница не зависит от вики: своего сайдбара и поиска здесь нет.
   Фильтры: поиск, фракция, тип, сортировка (стилизованные выпадающие списки).
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { ARROW, initDropdowns, placeMenu, refreshDropdown } from "./dropdown.js";
import { bootI18n, getLang, onLangChange, registerI18n, t } from "./i18n.js";
import { DATABASE_I18N } from "./i18n/database.js";
import { $, $$, abs, debounce, emptyBlock, escapeHtml, loc, locObj, safeColor } from "./utils.js";
import { initHeader, initReveal } from "./ui.js";

registerI18n(DATABASE_I18N);

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

/* ----------------------------------------------------------------- данные -- */
async function loadAll() {
  const [factions, units, buildings, tags] = await Promise.all(
    ["factions", "units", "buildings", "tags"].map((name) =>
      fetch(abs(`data/${name}.json?v=${WWN_CONFIG.version}`)).then((res) => {
        if (!res.ok) throw new Error(name);
        return res.json();
      })
    )
  );
  data.factions = factions.factions || [];
  data.units = units.units || [];
  data.buildings = buildings.buildings || [];
  data.tags = tags.tags || [];
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

/* ---------------------------------------------------------------- фильтры -- */
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
    render();
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

function buildTypeFilter() {
  const select = $("#databaseType");
  if (!select) return;
  bindSelect(select, (value) => { state.type = value; });
  const types = tabTypes();

  if (state.type !== "all" && !types.includes(state.type)) state.type = "all";
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
      a.label.localeCompare(b.label)
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

  const groups = new Map();
  options.forEach((tag) => {
    if (!groups.has(tag.group)) groups.set(tag.group, []);
    groups.get(tag.group).push(tag);
  });

  const body = tagPanel.querySelector(".tag-panel__body");
  body.replaceChildren(
    ...[...groups.keys()]
      .sort((a, b) => (TAG_GROUP_ORDER[a] ?? 9) - (TAG_GROUP_ORDER[b] ?? 9))
      .map((group) => {
        const section = document.createElement("div");
        section.className = "tag-panel__group";
        const title = document.createElement("div");
        title.className = "tag-panel__group-title";
        title.textContent = tagGroupTitle(group);
        const chips = document.createElement("div");
        chips.className = "tag-panel__chips";
        groups.get(group).forEach((tag) => {
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
  const value = tagButton.querySelector(".wwn-select__value");
  if (value) value.textContent = state.tags.size ? `${label}: ${state.tags.size}` : label;
  tagButton.setAttribute("aria-label", label);
}

function closeTagPanel() {
  if (!tagPanelOpen) return;
  tagPanelOpen = false;
  if (typeof tagPanel.hidePopover === "function") tagPanel.hidePopover();
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
      <button type="button" class="btn btn--ghost btn--sm tag-panel__reset"></button>
      <button type="button" class="btn btn--sm tag-panel__apply"></button>
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
    requestAnimationFrame(() => placeMenu(tagPanel, tagButton, 420, panelWidth()));
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
      render();
      return;
    }
    if (event.target.closest(".tag-panel__apply")) {
      state.tags = new Set(tagDraft);
      updateTagButton();
      render();
      closeTagPanel();
    }
  });
}

function syncTagFilter() {
  if (!tagPanel) initTagFilter();
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

/* -------------------------------------------------------------------- вкладки -- */
function initTabs() {
  const tabs = $$("#databaseTabs .tab");
  const activate = (tab, focus = false) => {
    state.tab = tab;
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && focus) btn.focus();
    });
    try { history.replaceState(null, "", `#${tab}`); } catch {}
    buildTypeFilter();
    syncTagFilter();
    updateFilterVisibility();
    render();
  };
  tabs.forEach((btn) => {
    // подсветка всегда соответствует текущей вкладке (в т.ч. после перезагрузки с #units)
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });

  // навигация по табам стрелками (паттерн WAI-ARIA tabs)
  $("#databaseTabs")?.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    let next = null;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    activate(next.dataset.tab, true);
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (["factions", "units", "buildings"].includes(hash) && hash !== state.tab) activate(hash);
  });
}

/* ---------------------------------------------------------------- карточки -- */
const chip = (text, className = "") => `<span class="chip ${className}">${escapeHtml(text)}</span>`;

/** Общая шкала полос: за 100% берём максимум, а при длинном хвосте
 *  (выбросы вроде 999999) — удвоенную медиану. Шкала нелинейная (^0.7),
 *  чтобы низкие значения не выглядели пустым местом. */
const scale = {
  hp: { reference: 1, median: 0 },
  shield: { reference: 1, median: 0 },
  dps: { reference: 1, median: 0 },
  speed: { reference: 1, median: 0 },
  range: { reference: 1, median: 0 }
};
/** Показываем полосу только если характеристика есть хотя бы у кого-то
 *  (например, у строений нет скорости — полосу не рисуем). */
const hasStat = { hp: false, shield: false, dps: false, speed: false, range: false };

const median = (sorted) => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function computeScale() {
  const all = [...data.units, ...data.buildings];
  Object.keys(scale).forEach((key) => {
    const values = all
      .map((item) => item[key])
      .filter((value) => typeof value === "number" && value > 0)
      .sort((a, b) => a - b);
    hasStat[key] = values.length > 0;
    if (!values.length) {
      scale[key] = { reference: 1, median: 0 };
      return;
    }
    const med = median(values);
    const max = values[values.length - 1];
    scale[key] = { reference: Math.max(1, max <= med * 4 ? max : med * 2), median: med };
  });
}

const formatValue = (value) => {
  if (!Number.isFinite(value) || value === 0) return 0;
  const magnitude = Math.abs(value);
  if (magnitude < 10) return Math.round(value * 100) / 100;
  if (magnitude < 1000) return Math.round(value * 10) / 10;
  return Math.round(value);
};

const BAR_CURVE = 0.7;

const barPercent = (value, reference) =>
  value > 0 && reference > 0
    ? Math.max(6, Math.min(100, Math.round(((value / reference) ** BAR_CURVE) * 100)))
    : 0;

const statBar = (key, label, value, color) => {
  const safe = Number.isFinite(value) ? value : 0;
  const { reference = 1, median: med = 0 } = scale[key] || {};
  const percent = barPercent(safe, reference);
  const medianPercent = barPercent(med, reference);
  return `<div class="statbar" data-stat="${key}" style="--faction-color:${color};--median:${medianPercent}%">
    <span class="statbar__label">${escapeHtml(label)}</span>
    <span class="statbar__track"><span class="statbar__fill" data-percent="${percent}"></span></span>
    <span class="statbar__val">${formatValue(safe)}</span>
  </div>`;
};

function unitCard(item) {
  const lang = state.lang;
  const color = factionColor(item.faction);
  const name = loc(item.name, lang);
  // картинка по умолчанию — по id; item.image переопределяет, "" скрывает
  const imageSrc = item.image === "" ? "" : item.image || `assets/img/database/${item.id}.webp`;
  const initials = name.slice(0, 2).toUpperCase();
  const image = imageSrc
    ? `<img src="${escapeHtml(abs(imageSrc))}" alt="${escapeHtml(name)}" data-initials="${escapeHtml(initials)}" loading="lazy">`
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

  const article = document.createElement("article");
  article.className = "unit-card";
  article.style.setProperty("--faction-color", color);
  article.dataset.reveal = "";
  article.innerHTML =
    `<div class="unit-card__top">
       <div class="unit-card__img">${image}</div>
       <div class="unit-card__name">${escapeHtml(name)}</div>
     </div>
     <div class="unit-card__tags">${chips}</div>
     ${costs}
     ${item.desc ? `<p class="unit-card__desc">${escapeHtml(loc(item.desc, lang))}</p>` : ""}
     ${bars ? `<div class="statbars">${bars}</div>` : ""}
     ${matchups}`;
  return article;
}

function factionCard(faction, counts) {
  const lang = state.lang;
  const color = safeColor(faction.color, "#29b8ff");
  const name = loc(faction.name, lang);
  const emblem = faction.emblem
    ? `<img src="${escapeHtml(abs(faction.emblem))}" alt="${escapeHtml(name)}" loading="lazy">`
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

  const article = document.createElement("article");
  article.className = "faction-card";
  article.style.setProperty("--faction-color", color);
  article.dataset.reveal = "";
  article.innerHTML =
    `<div class="faction-card__head">
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
     ${faction.lore ? `<a class="btn btn--sm faction-card__link" href="wiki/article.html?p=${encodeURIComponent(faction.lore)}">${escapeHtml(t("database.openLore", lang))}</a>` : ""}`;
  return article;
}

/* ------------------------------------------------------------------- рендер -- */
const matches = (item, lang) => {
  if (!state.search) return true;
  const tags = (item.tags || []).map((id) => `${id} ${tagLabel(id, lang)}`).join(" ");
  const haystack = `${loc(item.name, lang)} ${loc(item.role, lang)} ${loc(item.desc, lang)} ${tags}`.toLowerCase();
  return haystack.includes(state.search);
};

function render() {
  const grid = $("#databaseGrid");
  const count = $("#databaseCount");
  if (!grid) return;
  const lang = state.lang;
  grid.dataset.mode = state.tab;

  let items = [];
  let nodes = [];

  if (state.tab === "factions") {
    items = data.factions.filter((faction) => matches(faction, lang));
    nodes = items.map((faction) =>
      factionCard(faction, factionCounts.get(faction.id) || { units: 0, buildings: 0 })
    );
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
          ? loc(a.name, lang).localeCompare(loc(b.name, lang))
          : (b[state.sort] || 0) - (a[state.sort] || 0)
      );
    nodes = items.map((item) => unitCard(item));
  }

  if (!items.length) {
    grid.replaceChildren(emptyBlock(t("database.empty", lang)));
  } else {
    grid.replaceChildren(...nodes);
    initReveal(grid);
    requestAnimationFrame(() => {
      grid.querySelectorAll(".statbar__fill").forEach((fill) => {
        fill.style.width = `${fill.dataset.percent || 0}%`;
      });
    });
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

/* --------------------------------------------------------------------- boot -- */
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
  render();
}

let dataReady = false;

async function boot() {
  const lang = bootI18n();
  initHeader();
  initDropdowns();
  initTabs();
  initImageFallback();

  const debouncedRender = debounce(render, 140);
  $("#databaseSearch")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    debouncedRender();
  });

  try {
    await loadAll();
    buildLookups();
    computeScale();
    dataReady = true;
  } catch {
    // данные не загрузились — шапка, меню и язык должны работать всё равно
  }

  renderPage(lang);
  onLangChange(renderPage);
  initReveal();
}

boot();
