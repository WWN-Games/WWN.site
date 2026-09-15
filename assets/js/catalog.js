/* ============================================================================
   WWN — каталог (ES-модуль): фракции, юниты, строения
   Фильтры: поиск, фракция, тип, сортировка (стилизованные выпадающие списки).
   ============================================================================ */

import { initDropdowns, refreshDropdown } from "./dropdown.js";
import { getLang, t } from "./i18n.js";
import { $, $$, abs, debounce, emptyBlock, escapeHtml, loc, locObj, safeColor } from "./utils.js";
import { initReveal } from "./ui.js";
import { initShell } from "./wiki-shell.js";

const state = {
  lang: getLang(),
  tab: (location.hash || "#factions").replace("#", ""),
  search: "",
  faction: "all",
  type: "all",
  tag: "all",
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
  const label = t(`catalog.type.${type}`, lang);
  return label === `catalog.type.${type}` ? type : label;
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
      fetch(abs(`data/${name}.json`), { cache: "no-cache" }).then((res) => {
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
    catalogFaction: showFilters,
    catalogType: showFilters && hasTypes,
    catalogTag: showFilters && hasTags,
    catalogSort: showFilters
  };

  Object.entries(visibility).forEach(([id, visible]) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.classList.toggle("is-hidden", !visible);
    select.closest(".wwn-select")?.classList.toggle("is-hidden", !visible);
    if (!visible) refreshDropdown(select);
  });
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
  const select = $("#catalogFaction");
  if (!select) return;
  bindSelect(select, (value) => { state.faction = value; });
  fillSelect(
    select,
    data.factions.map((faction) => ({ value: faction.id, label: loc(faction.name, state.lang) })),
    state.faction,
    "catalog.filter.all"
  );
}

function buildTypeFilter() {
  const select = $("#catalogType");
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
    "catalog.filter.all"
  );
}

/* Порядок групп тегов в списке: уровень, класс, движение, прочее. */
const TAG_GROUP_ORDER = { tier: 0, class: 1, movement: 2, mod: 3 };

function buildTagFilter() {
  const select = $("#catalogTag");
  if (!select) return;
  bindSelect(select, (value) => { state.tag = value; });
  const ids = tabTagIds();

  if (state.tag !== "all" && !ids.includes(state.tag)) state.tag = "all";
  if (!ids.length) {
    select.replaceChildren();
    refreshDropdown(select);
    return;
  }

  const options = ids
    .map((id) => {
      const tag = tagMap.get(id);
      return { value: id, label: tag ? loc(tag.name, state.lang) || id : id, group: tag?.group || "mod" };
    })
    .sort((a, b) =>
      (TAG_GROUP_ORDER[a.group] ?? 9) - (TAG_GROUP_ORDER[b.group] ?? 9) ||
      a.label.localeCompare(b.label)
    );

  fillSelect(select, options, state.tag, "catalog.filter.all");
}

function buildSortFilter() {
  const select = $("#catalogSort");
  if (!select) return;
  bindSelect(select, (value) => { state.sort = value; });
  fillSelect(
    select,
    ["name", "cost", "hp", "dps"].map((key) => ({ value: key, label: t(`catalog.sort.${key}`, state.lang) })),
    state.sort,
    null
  );
}

/* -------------------------------------------------------------------- вкладки -- */
function initTabs() {
  const tabs = $$("#catalogTabs .tab");
  const activate = (tab) => {
    state.tab = tab;
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    try { history.replaceState(null, "", `#${tab}`); } catch {}
    buildTypeFilter();
    buildTagFilter();
    updateFilterVisibility();
    render();
  };
  tabs.forEach((btn) => {
    // подсветка всегда соответствует текущей вкладке (в т.ч. после перезагрузки с #units)
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });
  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (["factions", "units", "buildings"].includes(hash) && hash !== state.tab) activate(hash);
  });
}

/* ---------------------------------------------------------------- карточки -- */
const chip = (text, className = "") => `<span class="chip ${className}">${escapeHtml(text)}</span>`;

/** Общая шкала полос для всех карточек сразу: абсолютный максимум
 *  среди юнитов и строений. Самое высокое значение = 100% (полная полоса),
 *  остальные — пропорционально меньше. */
const scale = { hp: 1, shield: 1, dps: 1, speed: 1, range: 1 };
/** Показываем полосу только если характеристика есть хотя бы у кого-то
 *  (например, у строений нет скорости — полосу не рисуем). */
const hasStat = { hp: false, shield: false, dps: false, speed: false, range: false };

function computeScale() {
  const all = [...data.units, ...data.buildings];
  Object.keys(scale).forEach((key) => {
    const values = all.map((item) => (Number.isFinite(item[key]) ? item[key] : 0));
    scale[key] = Math.max(1, ...values);
    hasStat[key] = values.some((value) => value > 0);
  });
}

const formatValue = (value) => {
  if (!Number.isFinite(value) || value === 0) return 0;
  const magnitude = Math.abs(value);
  if (magnitude < 10) return Math.round(value * 100) / 100;
  if (magnitude < 1000) return Math.round(value * 10) / 10;
  return Math.round(value);
};

const statBar = (label, value, max, color) => {
  const safe = Number.isFinite(value) ? value : 0;
  const percent = safe > 0 && max > 0 ? Math.max(3, Math.min(100, Math.round((safe / max) * 100))) : 0;
  return `<div class="statbar" style="--faction-color:${color}">
    <span class="statbar__label">${escapeHtml(label)}</span>
    <span class="statbar__track"><span class="statbar__fill" style="width:${percent}%"></span></span>
    <span class="statbar__val">${formatValue(safe)}</span>
  </div>`;
};

function unitCard(item) {
  const lang = state.lang;
  const color = factionColor(item.faction);
  const name = loc(item.name, lang);
  // картинка по умолчанию — по id; item.image переопределяет, "" скрывает
  const imageSrc = item.image === "" ? "" : item.image || `assets/img/catalog/${item.id}.webp`;
  const initials = name.slice(0, 2).toUpperCase();
  const image = imageSrc
    ? `<img src="${escapeHtml(abs(imageSrc))}" alt="${escapeHtml(name)}" data-initials="${escapeHtml(initials)}" loading="lazy">`
    : `<span>${escapeHtml(initials)}</span>`;

  const chips = [
    chip(factionName(item.faction, lang), "chip--faction"),
    item.type ? chip(typeLabel(item.type, lang)) : "",
    ...(item.tags || []).map((id) => chip(tagLabel(id, lang), "chip--tag")),
    item.role ? chip(loc(item.role, lang)) : "",
    item.draft ? chip(t("catalog.draft", lang), "chip--draft") : ""
  ].join("");

  // полосы показываются: нет урона — честный 0, нет характеристики у вида — полосы нет
  const barDefs = [
    ["hp", "catalog.hp"],
    ["shield", "catalog.shield"],
    ["dps", "catalog.dps"],
    ["speed", "catalog.speed"],
    ["range", "catalog.range"]
  ];
  const bars = barDefs
    .filter(([key]) => hasStat[key])
    .map(([key, label]) => statBar(t(label, lang), item[key] || 0, scale[key], color))
    .join("");

  const strong = list(item.strongVs, lang);
  const weak = list(item.weakVs, lang);
  const matchups = strong.length || weak.length
    ? `<div class="unit-card__lists">
         ${strong.length ? `<div><b>${t("catalog.strong", lang)}:</b> <span class="vs-strong">${escapeHtml(strong.join(", "))}</span></div>` : ""}
         ${weak.length ? `<div><b>${t("catalog.weak", lang)}:</b> <span class="vs-weak">${escapeHtml(weak.join(", "))}</span></div>` : ""}
       </div>`
    : "";

  const costs = item.cost || item.buildTime
    ? `<div class="unit-card__sub">
         ${item.cost ? chip(`${t("catalog.cost", lang)}: ${item.cost}`) : ""}
         ${item.buildTime ? chip(`${t("catalog.buildTime", lang)}: ${item.buildTime}${t("catalog.seconds", lang)} (1x)`) : ""}
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
         ${chip(`${t("catalog.tab.units", lang)}: ${counts.units}`)}
         ${chip(`${t("catalog.tab.buildings", lang)}: ${counts.buildings}`)}
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
       ${block(t("catalog.faction.playstyle", lang), loc(faction.playstyle, lang))}
       ${block(t("catalog.faction.specialty", lang), loc(faction.specialty, lang))}
       ${blockList(t("catalog.strong", lang), strengths)}
       ${blockList(t("catalog.weak", lang), weaknesses)}
     </div>
     ${faction.lore ? `<a class="btn btn--sm faction-card__link" href="article.html?p=${encodeURIComponent(faction.lore)}">${escapeHtml(t("catalog.openLore", lang))}</a>` : ""}`;
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
  const grid = $("#catalogGrid");
  const count = $("#catalogCount");
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
        if (state.tag !== "all" && !(item.tags || []).includes(state.tag)) return false;
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
    grid.replaceChildren(emptyBlock(t("catalog.empty", lang)));
  } else {
    grid.replaceChildren(...nodes);
    initReveal(grid);
  }
  if (count) count.textContent = t("catalog.count", lang, { n: items.length });
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
async function boot() {
  initDropdowns();
  initTabs();
  initImageFallback();

  const debouncedRender = debounce(render, 140);
  $("#catalogSearch")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    debouncedRender();
  });

  let dataReady = false;
  try {
    await loadAll();
    buildLookups();
    computeScale();
    dataReady = true;
  } catch {
    // данные не загрузились — оболочка (шапка, меню, язык) должна работать всё равно
  }

  await initShell({
    slug: null,
    onRender: (lang) => {
      state.lang = lang;
      document.title = t("meta.title.catalog", lang);

      if (!dataReady) {
        const grid = $("#catalogGrid");
        if (grid) grid.replaceChildren(emptyBlock(t("catalog.noData", lang)));
        return;
      }

      buildFactionFilter();
      buildTypeFilter();
      buildTagFilter();
      buildSortFilter();
      updateFilterVisibility();
      render();
    }
  });
}

boot();
