<script lang="ts">
  /* ============================================================================
     WWN — полная карточка юнита или строения в модальном окне.
     Показывает все характеристики, сортируемую таблицу оружия, строителя,
     заводы и транспортные отделения.
     ============================================================================ */

  import { Close } from "@icon-park/svg";

  import { iconSvg } from "@/components/ui/icon";
  import { type DictKey, t } from "@/i18n";
  import type { ExplorerItem, ExplorerTag } from "@/lib/database";
  import type { Lang } from "@/lib/site";

  interface Props {
    open: boolean;
    item: ExplorerItem | null;
    tags: ExplorerTag[];
    lang: Lang;
    compared: boolean;
    onclose: () => void;
    oncompare: (item: ExplorerItem) => void;
    ondetail: (id: string) => void;
  }

  let { open, item, tags, lang, compared, onclose, oncompare, ondetail }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  type WeaponSortKey =
    | "name"
    | "count"
    | "damage"
    | "fireDelay"
    | "dps"
    | "tags"
    | "spread"
    | "splashRadius"
    | "stunDuration";
  let sortKey = $state<WeaponSortKey>("name");
  let sortDirection = $state<"asc" | "desc">("asc");

  const tagMap = $derived(new Map(tags.map((tag) => [tag.id, tag.name[lang]])));
  const unloadKeys: Record<string, DictKey> = {
    shore: "database.unload.shore",
    water: "database.unload.water",
    air: "database.unload.air",
    underwater: "database.unload.underwater",
    space: "database.unload.space",
  };
  const locale = $derived(lang === "en" ? "en-US" : "ru-RU");
  const formatter = $derived(
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 }),
  );

  function tagName(id: string): string {
    return tagMap.get(id) ?? id;
  }

  function number(value: number | undefined): string {
    return value === undefined ? "—" : formatter.format(value);
  }

  function weaponTagText(tags: string[]): string {
    return tags.length ? tags.map(tagName).join(", ") : "—";
  }

  const weapons = $derived.by(() => {
    const list = item?.weapons ? [...item.weapons] : [];
    const collate = new Intl.Collator(locale);
    const sign = sortDirection === "asc" ? 1 : -1;
    const compare = (a: (typeof list)[number], b: (typeof list)[number]): number => {
      let diff = 0;
      switch (sortKey) {
        case "name":
          diff = collate.compare(a.name, b.name);
          break;
        case "tags":
          diff = collate.compare(weaponTagText(a.tags), weaponTagText(b.tags));
          break;
        case "spread":
          diff = (a.spread ?? 0) - (b.spread ?? 0);
          break;
        case "splashRadius":
          diff = (a.splashRadius ?? 0) - (b.splashRadius ?? 0);
          break;
        case "stunDuration":
          diff = (a.stunDuration ?? 0) - (b.stunDuration ?? 0);
          break;
        default:
          diff = a[sortKey] - b[sortKey];
      }
      return diff ? sign * diff : collate.compare(a.name, b.name);
    };
    return list.sort(compare);
  });

  function toggleSort(key: typeof sortKey): void {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = key === "name" || key === "tags" ? "asc" : "desc";
    }
  }

  function ariaSort(key: typeof sortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  $effect(() => {
    const element = dialog;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });

  $effect(() => {
    item;
    sortKey = "name";
    sortDirection = "asc";
  });

  function handleClose(): void {
    if (open) onclose();
  }

  function openUnit(id: string): void {
    ondetail(id);
  }
</script>

<dialog
  class="detail-dialog"
  bind:this={dialog}
  aria-labelledby="detailDialogTitle"
  onclose={handleClose}
  onclick={(event) => { if (event.target === dialog) onclose(); }}
>
  {#if item}
    <div class="detail-dialog__panel">
      <header class="detail-hero" style={`--faction-color:${item.factionColor}`}>
        <div class="detail-hero__img">
          {#if item.image}
            <img src={item.image} alt={item.name} width="256" height="256" decoding="async" />
          {:else}
            {item.initials}
          {/if}
        </div>
        <div class="detail-hero__body">
          <span class="kicker">{t(lang, "database.detail.title")}</span>
          <h2 id="detailDialogTitle">{item.name}</h2>
          <div class="detail-hero__badges">
            <span class="chip chip--faction">{item.factionName}</span>
            {#each item.tags as id (id)}
              <span class="chip chip--tag">{tagName(id)}</span>
            {/each}
            {#if item.role}<span class="chip">{item.role}</span>{/if}
          </div>
          {#if item.desc}<p class="detail-hero__desc">{item.desc}</p>{/if}
        </div>
        <button class="icon-btn detail-dialog__close" type="button" aria-label={t(lang, "database.detail.close")} onclick={onclose}>
          {@html iconSvg(Close)}
        </button>
      </header>

      <div class="detail-dialog__body">
        <section class="detail-section">
          <h3>{t(lang, "database.detail.characteristics")}</h3>
          <div class="detail-stats">
            <div><span>{t(lang, "database.fullCost")}</span><b>{number(item.fullCost)}</b></div>
            <div><span>{t(lang, "database.cost")}</span><b>{number(item.cost)}</b></div>
            <div><span>{t(lang, "database.energy")}</span><b>{number(item.energy)}</b></div>
            <div><span>{t(lang, "database.buildTime")}</span><b>{number(item.buildTime)}{t(lang, "database.secondsAtSpeed1")}</b></div>
            <div><span>{t(lang, "database.hp")}</span><b>{number(item.hp)}</b></div>
            <div><span>{t(lang, "database.shield")}</span><b>{number(item.shield)}</b></div>
            <div><span>{t(lang, "database.armor")}</span><b>{number(item.armor)}</b></div>
            <div><span>{t(lang, "database.selfRegen")}</span><b>{number(item.selfRegen)}</b></div>
            <div><span>{t(lang, "database.shieldRegen")}</span><b>{number(item.shieldRegen)}</b></div>
            <div><span>{t(lang, "database.speed")}</span><b>{number(item.speed)}</b></div>
            {#if item.tab === "units"}
              <div><span>{t(lang, "database.turnSpeed")}</span><b>{number(item.turnSpeed)}</b></div>
            {/if}
            <div><span>{t(lang, "database.range")}</span><b>{number(item.range)}</b></div>
            <div><span>{t(lang, "database.dpsAll")}</span><b>{number(item.dps)}</b></div>
            <div><span>{t(lang, "database.compare.metric.dpsPerFullCost")}</span><b>{item.fullCost > 0 ? formatter.format((item.dps / item.fullCost) * 100) : "—"}</b></div>
            <div><span>{t(lang, "database.compare.metric.totalHpPerFullCost")}</span><b>{item.fullCost > 0 ? formatter.format(((item.hp + item.shield) / item.fullCost) * 100) : "—"}</b></div>
          </div>
          {#if item.strongVs.length > 0 || item.weakVs.length > 0}
            <div class="detail-vs">
              {#if item.strongVs.length > 0}<div><b>{t(lang, "database.strong")}:</b> <span class="vs-strong">{item.strongVs.join(", ")}</span></div>{/if}
              {#if item.weakVs.length > 0}<div><b>{t(lang, "database.weak")}:</b> <span class="vs-weak">{item.weakVs.join(", ")}</span></div>{/if}
            </div>
          {/if}
        </section>

        <section class="detail-section">
          <h3>{t(lang, "database.weapons")} <span class="detail-section__count">{item.weapons.length}</span></h3>
          {#if item.weapons.length === 0}
            <p class="detail-empty">{t(lang, "database.weapon.noWeapons")}</p>
          {:else}
            <div class="weapon-table-wrap">
              <table class="weapon-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort("name")}><button type="button" onclick={() => toggleSort("name")}>{t(lang, "database.weapon.name")}</button></th>
                    <th scope="col" aria-sort={ariaSort("count")}><button type="button" onclick={() => toggleSort("count")}>{t(lang, "database.weapon.count")}</button></th>
                    <th scope="col" aria-sort={ariaSort("damage")}><button type="button" onclick={() => toggleSort("damage")}>{t(lang, "database.weapon.damage")}</button></th>
                    <th scope="col" aria-sort={ariaSort("fireDelay")}><button type="button" onclick={() => toggleSort("fireDelay")}>{t(lang, "database.weapon.fireDelay")}</button></th>
                    <th scope="col" aria-sort={ariaSort("dps")}><button type="button" onclick={() => toggleSort("dps")}>{t(lang, "database.weapon.dps")}</button></th>
                    <th scope="col" aria-sort={ariaSort("tags")}><button type="button" onclick={() => toggleSort("tags")}>{t(lang, "database.weapon.tags")}</button></th>
                    <th scope="col" aria-sort={ariaSort("spread")}><button type="button" onclick={() => toggleSort("spread")}>{t(lang, "database.weapon.spread")}</button></th>
                    <th scope="col" aria-sort={ariaSort("splashRadius")}><button type="button" onclick={() => toggleSort("splashRadius")}>{t(lang, "database.weapon.splash")}</button></th>
                    <th scope="col" aria-sort={ariaSort("stunDuration")}><button type="button" onclick={() => toggleSort("stunDuration")}>{t(lang, "database.weapon.stun")}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {#each weapons as weapon, index (index)}
                    <tr>
                      <td class="weapon-table__name">{weapon.name}</td>
                      <td>{weapon.count}</td>
                      <td>{formatter.format(weapon.damage)}</td>
                      <td>{formatter.format(weapon.fireDelay)}{t(lang, "database.seconds")}</td>
                      <td class="weapon-table__dps">{formatter.format(weapon.dps)}</td>
                      <td>
                        <div class="weapon-table__tags">
                          {#each weapon.tags as id (id)}
                            <span class="chip chip--tag">{tagName(id)}</span>
                          {/each}
                          {#if weapon.tags.length === 0}—{/if}
                        </div>
                      </td>
                      <td>{weapon.spread !== undefined ? formatter.format(weapon.spread) : "—"}</td>
                      <td>{weapon.splashRadius !== undefined ? formatter.format(weapon.splashRadius) : "—"}</td>
                      <td>{weapon.stunDuration !== undefined ? `${formatter.format(weapon.stunDuration)}${t(lang, "database.seconds")}` : "—"}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>

        {#if item.builder}
          <section class="detail-section">
            <h3>{t(lang, "database.builder")}</h3>
            <div class="detail-stats detail-stats--builder">
              <div><span>{t(lang, "database.builder.buildRange")}</span><b>{number(item.builder.buildRange)}</b></div>
              <div><span>{t(lang, "database.builder.repairSpeed")}</span><b>{number(item.builder.repairSpeed)}</b></div>
              <div><span>{t(lang, "database.builder.buildSpeed")}</span><b>{number(item.builder.buildSpeed)}</b></div>
              <div class="detail-stats__wide"><span>{t(lang, "database.builder.heals")}</span><b>{item.builder.healTags.length ? item.builder.healTags.map(tagName).join(", ") : "—"}</b></div>
            </div>
          </section>
        {/if}

        {#if item.factories.length > 0}
          <section class="detail-section">
            <h3>{t(lang, "database.factories")} <span class="detail-section__count">{item.factories.length}</span></h3>
            <div class="detail-cards">
              {#each item.factories as factory, index (factory.name + index)}
                <article class="detail-card">
                  <div class="detail-card__head">
                    <b>{factory.name}</b>
                    <span class="badge">{t(lang, "database.factory.speed")}: ×{formatter.format(factory.buildSpeed)}</span>
                  </div>
                  <div class="detail-card__label">{t(lang, "database.factory.units")}</div>
                  <div class="detail-links">
                    {#each factory.producedUnits as unit (unit.id)}
                      <button class="detail-link" type="button" onclick={() => openUnit(unit.id)}>
                        {unit.name}
                      </button>
                    {/each}
                    {#if factory.producedUnits.length === 0}—{/if}
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/if}

        {#if item.transports.length > 0}
          <section class="detail-section">
            <h3>{t(lang, "database.transports")} <span class="detail-section__count">{item.transports.length}</span></h3>
            <div class="detail-cards">
              {#each item.transports as transport, index (transport.name + index)}
                <article class="detail-card">
                  <div class="detail-card__head">
                    <b>{transport.name}</b>
                    <span class="badge">{t(lang, "database.transport.seats")}: {transport.seats}</span>
                  </div>
                  <div class="detail-card__label">{t(lang, "database.transport.cargo")}</div>
                  <div class="weapon-table__tags">
                    {#each transport.cargoTags as id (id)}<span class="chip chip--tag">{tagName(id)}</span>{/each}
                    {#if transport.cargoTags.length === 0}—{/if}
                  </div>
                  <div class="detail-card__label">{t(lang, "database.transport.unload")}</div>
                  <div class="detail-unload">
                    {#each transport.unload as option (option)}
                      <span class="chip">{t(lang, unloadKeys[option] ?? "database.unload.shore")}</span>
                    {/each}
                    {#if transport.unload.length === 0}—{/if}
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/if}
      </div>

      <footer class="detail-dialog__foot">
        <button class="btn btn--sm" type="button" onclick={() => oncompare(item)}>
          {compared ? t(lang, "database.detail.removeCompare") : t(lang, "database.detail.addCompare")}
        </button>
        <button class="btn btn--ghost btn--sm" type="button" onclick={onclose}>
          {t(lang, "database.detail.close")}
        </button>
      </footer>
    </div>
  {/if}
</dialog>
