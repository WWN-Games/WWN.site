/* ============================================================================
   WWN — сортировка списка подвигов.
   Карточки рендерятся на сервере, скрипт только меняет их порядок.
   ============================================================================ */

type SortKey = "order" | "destroyed" | "killed" | "payoff" | "loss" | "type" | "commander";

const NUMERIC: ReadonlySet<SortKey> = new Set([
  "order",
  "destroyed",
  "killed",
  "payoff",
  "loss",
  "type",
]);
const ATTRIBUTE: Record<SortKey, string> = {
  order: "sortOrder",
  destroyed: "sortDestroyed",
  killed: "sortKilled",
  payoff: "sortPayoff",
  loss: "sortLoss",
  type: "sortType",
  commander: "sortCommander",
};

let cleanup: (() => void) | null = null;

function sortValue(card: HTMLElement, key: SortKey): number | string | null {
  const raw = card.dataset[ATTRIBUTE[key]];
  if (raw === undefined || raw === "") return null;
  return NUMERIC.has(key) ? Number(raw) : raw;
}

function compare(
  a: HTMLElement,
  b: HTMLElement,
  key: SortKey,
  direction: 1 | -1,
  collator: Intl.Collator,
): number {
  const left = sortValue(a, key);
  const right = sortValue(b, key);

  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  if (typeof left === "number" && typeof right === "number") {
    return left === right ? 0 : direction * (left - right);
  }
  const result = collator.compare(String(left), String(right));
  return result === 0 ? 0 : direction * result;
}

function initFeats(): void {
  cleanup?.();
  cleanup = null;

  const select = document.getElementById("featsSort") as HTMLSelectElement | null;
  const grid = document.getElementById("featsGrid");
  const directionButton = document.getElementById("featsSortDirection") as HTMLButtonElement | null;
  if (!select || !grid || !directionButton) return;

  let direction: 1 | -1 = 1;
  const collator = new Intl.Collator(document.documentElement.lang || "ru", { numeric: true });

  const updateButton = (): void => {
    const label = direction === 1 ? directionButton.dataset.asc : directionButton.dataset.desc;
    directionButton.textContent = label ?? "";
    directionButton.setAttribute("aria-label", label ?? "");
  };

  const sort = (): void => {
    const key = select.value as SortKey;
    const cards = [...grid.querySelectorAll<HTMLElement>("[data-feat-id]")];
    cards.sort((a, b) => {
      const diff = compare(a, b, key, direction, collator);
      if (diff) return diff;
      const order = Number(a.dataset.sortOrder ?? 0) - Number(b.dataset.sortOrder ?? 0);
      if (order) return order;
      return collator.compare(a.dataset.name ?? "", b.dataset.name ?? "");
    });
    const fragment = document.createDocumentFragment();
    for (const card of cards) fragment.append(card);
    grid.append(fragment);
  };

  const onSortChange = (): void => {
    direction =
      select.value === "order" || select.value === "type" || select.value === "commander" ? 1 : -1;
    updateButton();
    sort();
  };

  const onDirectionClick = (): void => {
    direction = direction === 1 ? -1 : 1;
    updateButton();
    sort();
  };

  updateButton();
  select.addEventListener("change", onSortChange);
  directionButton.addEventListener("click", onDirectionClick);

  cleanup = () => {
    select.removeEventListener("change", onSortChange);
    directionButton.removeEventListener("click", onDirectionClick);
  };
}

document.addEventListener("astro:page-load", initFeats);
initFeats();
