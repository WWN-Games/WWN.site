/* ============================================================================
   WWN — каталог (ES-модуль): фракции, юниты, строения
   Фильтры: поиск, фракция, тип, сортировка (стилизованные выпадающие списки).
   ============================================================================ */

import "./wiki.js"; // оболочка вики: сайдбар, поиск, шапка
import { initDropdowns, refreshDropdown } from "./dropdown.js";
import { getLang, t } from "./i18n.js";
import { $, $$, abs, initReveal } from "./ui.js";

const state = {
  lang: getLang(),
  tab: (location.hash || "#factions").replace("#", ""),
  search: "",
  faction: "all",
  type: "all",
  sort: "name"
};
if (!["factions", "units", "buildings"].includes(state.tab)) state.tab = "factions";

const data = { factions: [], units: [], buildings: [], tags: [] };

const loc = (obj, lang) => (obj ? obj[lang] || obj.ru || obj.en || "" : "");
const list = (obj, lang) => {
  const value = obj ? obj[lang] || obj.ru || obj.en || [] : [];
  return Array.isArray(value) ? value : [value];
};
const typeLabel = (type, lang) => t(`catalog.type.${type}`, lang) || type;

const tagLabel = (id, lang) => {
  const tag = data.tags.find((t) => t.id === id);
  return tag ? loc(tag.name, lang) || id : id;
};
const factionColor = (id) => data.factions.find((f) => f.id === id)?.color || "#29b8ff";
const factionName = (id, lang) => {
  const faction = data.factions.find((f) => f.id === id);
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

/* ---------------------------------------------------------------- фильтры -- */
/* На вкладке «Фракции» списков нет; на «Юнитах» и «Строениях» — все три. */
const tabTypes = () => {
  const source = state.tab === "units" ? data.units : state.tab === "buildings" ? data.buildings : [];
  return [...new Set(source.map((item) => item.type).filter(Boolean))];
};

function updateFilterVisibility() {
  const showFilters = state.tab !== "factions";
  const hasTypes = tabTypes().length > 0;
  const visibility = {
    catalogFaction: showFilters,
    catalogType: showFilters && hasTypes,
    catalogSort: showFilters
  };

  Object.entries(visibility).forEach(([id, visible]) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.classList.toggle("is-hidden", !visible);
    select.closest(".wwn-select")?.classList.toggle("is-hidden", !visible);
    if (!visible) document.getElementById(`wwn-menu-${id}`)?.hidePopover();
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
  fillSelect(
    select,
    data.factions.map((faction) => ({ value: faction.id, label: loc(faction.name, state.lang) })),
    state.faction,
    "catalog.filter.all"
  );
  select.onchange = () => {
    state.faction = select.value;
    render();
  };
}

function buildTypeFilter() {
  const select = $("#catalogType");
  if (!select) return;
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
  select.onchange = () => {
    state.type = select.value;
    render();
  };
}

function buildSortFilter() {
  const select = $("#catalogSort");
  if (!select) return;
  fillSelect(
    select,
    ["name", "cost", "hp", "dps"].map((key) => ({ value: key, label: t(`catalog.sort.${key}`, state.lang) })),
    state.sort,
    null
  );
  select.onchange = () => {
    state.sort = select.value;
    render();
  };
}

/* -------------------------------------------------------------------- вкладки -- */
function initTabs() {
  const tabs = $$("#catalogTabs .tab");
  const activate = (tab) => {
    state.tab = tab;
    tabs.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === tab));
    history.replaceState?.(null, "", `#${tab}`);
    buildTypeFilter();
    updateFilterVisibility();
    render();
  };
  tabs.forEach((btn) => {
    // подсветка всегда соответствует текущей вкладке (в т.ч. после перезагрузки с #units)
    btn.classList.toggle("is-active", btn.dataset.tab === state.tab);
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });
  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (["factions", "units", "buildings"].includes(hash) && hash !== state.tab) activate(hash);
  });
}

/* ---------------------------------------------------------------- карточки -- */
const chip = (text, className = "") => `<span class="chip ${className}">${text}</span>`;

/** Общая шкала полос для всех карточек сразу: абсолютный максимум
 *  среди юнитов и строений. Самое высокое значение = 100% (полная полоса),
 *  остальные — пропорционально меньше. */
const scale = { hp: 1, shield: 1, dps: 1, speed: 1, range: 1 };

function computeScale() {
  const all = [...data.units, ...data.buildings];
  Object.keys(scale).forEach((key) => {
    const values = all.map((item) => (Number.isFinite(item[key]) ? item[key] : 0));
    scale[key] = Math.max(1, ...values);
  });
}

const formatValue = (value) => {
  if (!Number.isFinite(value) || value === 0) return 0;
  const abs = Math.abs(value);
  if (abs < 10) return Math.round(value * 100) / 100;
  if (abs < 1000) return Math.round(value * 10) / 10;
  return Math.round(value);
};

const statBar = (label, value, max, color) => {
  const safe = Number.isFinite(value) ? value : 0;
  const percent = safe > 0 && max > 0 ? Math.max(3, Math.min(100, Math.round((safe / max) * 100))) : 0;
  return `<div class="statbar" style="--faction-color:${color}">
    <span class="statbar__label">${label}</span>
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
    ? `<img src="${abs(imageSrc)}" alt="${name}" data-initials="${initials}" loading="lazy">`
    : `<span>${initials}</span>`;

  const chips = [
    chip(factionName(item.faction, lang), "chip--faction"),
    item.type ? chip(typeLabel(item.type, lang)) : "",
    ...(item.tags || []).map((id) => chip(tagLabel(id, lang), "chip--tag")),
    item.role ? chip(loc(item.role, lang)) : "",
    item.draft ? chip(t("catalog.draft", lang), "chip--draft") : ""
  ].join("");

  // полосы всегда показываются: нет урона — честный 0
  const bars = [
    statBar(t("catalog.hp", lang), item.hp || 0, scale.hp, color),
    statBar(t("catalog.shield", lang), item.shield || 0, scale.shield, color),
    statBar(t("catalog.dps", lang), item.dps || 0, scale.dps, color),
    statBar(t("catalog.speed", lang), item.speed || 0, scale.speed, color),
    statBar(t("catalog.range", lang), item.range || 0, scale.range, color)
  ].join("");

  const strong = list(item.strongVs, lang);
  const weak = list(item.weakVs, lang);
  const matchups = strong.length || weak.length
    ? `<div class="unit-card__lists">
         ${strong.length ? `<div><b>${t("catalog.strong", lang)}:</b> <span class="vs-strong">${strong.join(", ")}</span></div>` : ""}
         ${weak.length ? `<div><b>${t("catalog.weak", lang)}:</b> <span class="vs-weak">${weak.join(", ")}</span></div>` : ""}
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
       <div>
         <div class="unit-card__name">${name}</div>
         <div class="unit-card__sub">${chips}</div>
       </div>
     </div>
     ${costs}
     ${item.desc ? `<p class="unit-card__desc">${loc(item.desc, lang)}</p>` : ""}
     ${bars ? `<div class="statbars">${bars}</div>` : ""}
     ${matchups}`;
  return article;
}

function factionCard(faction, counts) {
  const lang = state.lang;
  const color = faction.color || "#29b8ff";
  const name = loc(faction.name, lang);
  const emblem = faction.emblem
    ? `<img src="${abs(faction.emblem)}" alt="${name}" loading="lazy">`
    : `<span style="color:${color};font-family:var(--font-display)">${name.slice(0, 2)}</span>`;
  const strengths = list(faction.strengths, lang);
  const weaknesses = list(faction.weaknesses, lang);
  const counters = counts
    ? `<div class="unit-card__sub" style="margin-top:8px">
         ${chip(`${t("catalog.tab.units", lang)}: ${counts.units}`)}
         ${chip(`${t("catalog.tab.buildings", lang)}: ${counts.buildings}`)}
       </div>`
    : "";

  const block = (title, value) =>
    value ? `<div class="faction-block"><h5>${title}</h5><p>${value}</p></div>` : "";
  const blockList = (title, items) =>
    items.length ? `<div class="faction-block"><h5>${title}</h5><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : "";

  const article = document.createElement("article");
  article.className = "faction-card";
  article.style.setProperty("--faction-color", color);
  article.dataset.reveal = "";
  article.innerHTML =
    `<div class="faction-card__head">
       <div class="faction-card__emblem">${emblem}</div>
       <div>
         <div class="faction-card__name">${name}</div>
         <div class="faction-card__motto">${loc(faction.motto, lang)}</div>
         ${counters}
       </div>
     </div>
     ${faction.desc ? `<p class="faction-card__desc">${loc(faction.desc, lang)}</p>` : ""}
     <div class="faction-card__blocks">
       ${block(t("catalog.faction.playstyle", lang), loc(faction.playstyle, lang))}
       ${block(t("catalog.faction.specialty", lang), loc(faction.specialty, lang))}
       ${blockList(t("catalog.strong", lang), strengths)}
       ${blockList(t("catalog.weak", lang), weaknesses)}
     </div>
     ${faction.lore ? `<a class="btn btn--sm faction-card__link" href="article.html?p=${encodeURIComponent(faction.lore)}">${t("catalog.openLore", lang)}</a>` : ""}`;
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
      factionCard(faction, {
        units: data.units.filter((u) => u.faction === faction.id).length,
        buildings: data.buildings.filter((b) => b.faction === faction.id).length
      })
    );
  } else {
    const source = state.tab === "units" ? data.units : data.buildings;
    items = source
      .filter((item) => {
        if (!matches(item, lang)) return false;
        if (state.faction !== "all" && item.faction !== state.faction) return false;
        if (state.type !== "all" && item.type !== state.type) return false;
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
    grid.innerHTML = `<div class="catalog-empty">${t("catalog.empty", lang)}</div>`;
  } else {
    grid.replaceChildren(...nodes);
    initReveal(grid);
  }
  if (count) count.textContent = t("catalog.count", lang).replace("{n}", String(items.length));
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
      img.replaceWith(span);
    },
    true
  );
}

/* --------------------------------------------------------------------- boot -- */
async function boot() {
  document.title = t("meta.title.catalog", state.lang);
  initDropdowns();
  initTabs();
  initImageFallback();

  $("#catalogSearch")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  try {
    await loadAll();
  } catch (e) {
    const grid = $("#catalogGrid");
    if (grid) grid.innerHTML = `<div class="catalog-empty">${t("catalog.noData", state.lang)}</div>`;
    return;
  }

  buildFactionFilter();
  buildTypeFilter();
  buildSortFilter();
  computeScale();
  updateFilterVisibility();
  render();

  document.addEventListener("wwn:langchange", (event) => {
    state.lang = event.detail.lang;
    document.title = t("meta.title.catalog", state.lang);
    buildFactionFilter();
    buildTypeFilter();
    buildSortFilter();
    updateFilterVisibility();
    render();
  });
}

boot();
