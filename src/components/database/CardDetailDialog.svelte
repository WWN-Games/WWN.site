<script lang="ts">
  /* ============================================================================
     WWN — полная карточка юнита или строения в модальном окне.
     Показывает все характеристики, сортируемую таблицу оружия, строителя,
     заводы и транспортные отделения.
     ============================================================================ */

  import { Close } from "@icon-park/svg";

  import { iconSvg } from "@/components/ui/icon";
  import type { DetailLabels, ExplorerItem, ExplorerTag } from "@/lib/database";
  import type { Lang } from "@/lib/site";

  interface Props {
    open: boolean;
    item: ExplorerItem | null;
    tags: ExplorerTag[];
    lang: Lang;
    detail: DetailLabels;
    compared: boolean;
    onclose: () => void;
    oncompare: (item: ExplorerItem) => void;
    ondetail: (id: string) => void;
  }

  let { open, item, tags, lang, detail, compared, onclose, oncompare, ondetail }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  type WeaponSortKey =
    | "name"
    | "count"
    | "projectileCount"
    | "projectileDelay"
    | "damage"
    | "fireDelay"
    | "armourIgnoreAmount"
    | "mainDps"
    | "dps"
    | "tags"
    | "spread"
    | "splashRadius"
    | "stunDuration";
  let sortKey = $state<WeaponSortKey>("name");
  let sortDirection = $state<"asc" | "desc">("asc");

  const tagMap = $derived(new Map(tags.map((tag) => [tag.id, tag.name[lang]])));
  const detailColor = $derived(item?.factionColor ?? "#29b8ff");
  const unloadLabels = $derived.by((): Record<string, string> => ({
    shore: detail.unloadShore,
    water: detail.unloadWater,
    air: detail.unloadAir,
    underwater: detail.unloadUnderwater,
    space: detail.unloadSpace,
  }));

  const ftlLabels = $derived.by((): Record<string, string> => ({
    siv: detail.ftlSiv,
    plasma: detail.ftlPlasma,
    tele: detail.ftlTele,
  }));

  function ftlTags(type: string): string[] {
    if (type === "plasma") {
      return [
        detail.ftlInstant,
        detail.ftlTagAtmosphere,
        detail.ftlTagAlwaysVisible,
        detail.ftlTagGasRecharge,
      ];
    }
    if (type === "tele") return [detail.ftlInstant, detail.ftlTagStealth];
    return [detail.ftlTagMove, detail.ftlTagBigVisible];
  }
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
        case "armourIgnoreAmount":
          diff = (a.armourIgnoreAmount ?? 0) - (b.armourIgnoreAmount ?? 0);
          break;
        case "projectileCount":
          diff = (a.projectileCount ?? 1) - (b.projectileCount ?? 1);
          break;
        case "projectileDelay":
          diff = (a.projectileDelay ?? 0) - (b.projectileDelay ?? 0);
          break;
        case "mainDps":
          diff = Number(a.mainDps) - Number(b.mainDps);
          break;
        default:
          diff = a[sortKey] - b[sortKey];
      }
      return diff ? sign * diff : collate.compare(a.name, b.name);
    };
    return list.toSorted(compare);
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
  style={`--faction-color:${detailColor}`}
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
          <span class="kicker">{detail.title}</span>
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
        <div class="detail-hero__tools">
          {#if item.miniIcon}
            <img class="detail-hero__mini" src={item.miniIcon} alt="" width="36" height="36" decoding="async" />
          {/if}
          <button class="icon-btn detail-dialog__close" type="button" aria-label={detail.close} onclick={onclose}>
            {@html iconSvg(Close)}
          </button>
        </div>
      </header>

      <div class="detail-dialog__body">
        <section class="detail-section">
          <h3>{detail.characteristics}</h3>
          <div class="detail-stats">
            <div><span>{detail.fullCost}</span><b>{number(item.fullCost)}</b></div>
            <div><span>{detail.cost}</span><b>{number(item.cost)}</b></div>
            <div><span>{detail.energy}</span><b>{number(item.energy)}</b></div>
            <div><span>{detail.buildTime}</span><b>{number(item.buildTime)}{detail.secondsAtSpeed1}</b></div>
            <div><span>{detail.hp}</span><b>{number(item.hp)}</b></div>
            <div><span>{detail.shield}</span><b>{number(item.shield)}</b></div>
            <div><span>{detail.armor}</span><b>{number(item.armor)}</b></div>
            <div><span>{detail.selfRegen}</span><b>{number(item.selfRegen)}</b></div>
            <div><span>{detail.shieldRegen}</span><b>{number(item.shieldRegen)}</b></div>
            <div><span>{detail.speed}</span><b>{number(item.speed)}</b></div>
            {#if item.tab === "units"}
              <div><span>{detail.turnSpeed}</span><b>{number(item.turnSpeed)}</b></div>
            {/if}
            <div><span>{detail.range}</span><b>{number(item.range)}</b></div>
            <div><span>{detail.dpsMain}</span><b>{number(item.mainDps)}</b></div>
            <div><span>{detail.dpsAll}</span><b>{number(item.dps)}</b></div>
            <div><span>{detail.dpsPerFullCost}</span><b>{item.fullCost > 0 ? formatter.format((item.dps / item.fullCost) * 100) : "—"}</b></div>
            <div><span>{detail.totalHpPerFullCost}</span><b>{item.fullCost > 0 ? formatter.format(((item.hp + item.shield) / item.fullCost) * 100) : "—"}</b></div>
          </div>
          {#if item.strongVs.length > 0 || item.weakVs.length > 0}
            <div class="detail-vs">
              {#if item.strongVs.length > 0}<div><b>{detail.strong}:</b> <span class="vs-strong">{item.strongVs.join(", ")}</span></div>{/if}
              {#if item.weakVs.length > 0}<div><b>{detail.weak}:</b> <span class="vs-weak">{item.weakVs.join(", ")}</span></div>{/if}
            </div>
          {/if}
        </section>

        {#if item.missileDefense || item.torpedoDefense || item.laserDefense || item.domeShield || item.atmosphere || item.ftlJump}
          <section class="detail-section">
            <h3>{detail.abilities}</h3>
            <div class="detail-stats">
              {#if item.missileDefense}
                <div>
                  <span>{detail.abilityMissile}</span>
                  <b>{item.missileDefense.max} {detail.charges} · {formatter.format(item.missileDefense.recharge)} {detail.perSecond}</b>
                </div>
              {/if}
              {#if item.torpedoDefense}
                <div>
                  <span>{detail.abilityTorpedo}</span>
                  <b>{item.torpedoDefense.max} {detail.charges} · {formatter.format(item.torpedoDefense.recharge)} {detail.perSecond}</b>
                </div>
              {/if}
              {#if item.laserDefense}
                <div>
                  <span>{detail.abilityLaser}</span>
                  <b>{formatter.format(item.laserDefense.radius)} · {formatter.format(item.laserDefense.points)} · {formatter.format(item.laserDefense.regen)}/{detail.secondsShort}</b>
                </div>
              {/if}
              {#if item.domeShield}
                <div>
                  <span>{detail.abilityDome}</span>
                  <b>{formatter.format(item.domeShield.radius)} · {formatter.format(item.domeShield.points)} · {formatter.format(item.domeShield.regen)}/{detail.secondsShort}</b>
                </div>
              {/if}
              {#if item.atmosphere}
                <div><span>{detail.abilityAtmosphere}</span><b>{formatter.format(item.atmosphere.time)}{detail.seconds}</b></div>
              {/if}
              {#if item.ftlJump}
                <div class="detail-stats__wide">
                  <span>{detail.abilityFtl}</span>
                  <b>
                    {ftlLabels[item.ftlJump.type] ?? item.ftlJump.type}
                    · {formatter.format(item.ftlJump.chargeTime)}{detail.seconds}
                    · {formatter.format(item.ftlJump.cooldown)}{detail.seconds}
                    · {formatter.format(item.ftlJump.minDistance)}
                    {#if item.ftlJump.type === "siv" && item.ftlJump.jumpSpeed !== undefined}
                      · {detail.ftlSpeed}: {formatter.format(item.ftlJump.jumpSpeed)}
                    {/if}
                    {#if item.ftlJump.type === "plasma" && item.ftlJump.energyCost !== undefined}
                      · {formatter.format(item.ftlJump.energyCost)} {detail.energy}
                    {/if}
                  </b>
                  <div class="weapon-table__tags">
                    {#each ftlTags(item.ftlJump.type) as tag (tag)}
                      <span class="chip chip--ability">{tag}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </section>
        {/if}

        <section class="detail-section">
          <h3>{detail.weapons} <span class="detail-section__count">{item.weapons.length}</span></h3>
          {#if item.weapons.length === 0}
            <p class="detail-empty">{detail.noWeapons}</p>
          {:else}
            <div class="weapon-table-wrap">
              <table class="weapon-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort("name")}><button type="button" onclick={() => toggleSort("name")}>{detail.weaponName}</button></th>
                    <th scope="col" aria-sort={ariaSort("mainDps")}><button type="button" onclick={() => toggleSort("mainDps")}>{detail.weaponMain}</button></th>
                    <th scope="col" aria-sort={ariaSort("count")}><button type="button" onclick={() => toggleSort("count")}>{detail.weaponCount}</button></th>
                    <th scope="col" aria-sort={ariaSort("projectileCount")}><button type="button" onclick={() => toggleSort("projectileCount")}>{detail.weaponProjectiles}</button></th>
                    <th scope="col" aria-sort={ariaSort("projectileDelay")}><button type="button" onclick={() => toggleSort("projectileDelay")}>{detail.weaponProjectileDelay}</button></th>
                    <th scope="col" aria-sort={ariaSort("damage")}><button type="button" onclick={() => toggleSort("damage")}>{detail.weaponDamage}</button></th>
                    <th scope="col" aria-sort={ariaSort("fireDelay")}><button type="button" onclick={() => toggleSort("fireDelay")}>{detail.weaponFireDelay}</button></th>
                    <th scope="col" aria-sort={ariaSort("armourIgnoreAmount")}><button type="button" onclick={() => toggleSort("armourIgnoreAmount")}>{detail.weaponArmourIgnore}</button></th>
                    <th scope="col" aria-sort={ariaSort("dps")}><button type="button" onclick={() => toggleSort("dps")}>{detail.weaponDps}</button></th>
                    <th scope="col" aria-sort={ariaSort("tags")}><button type="button" onclick={() => toggleSort("tags")}>{detail.weaponTags}</button></th>
                    <th scope="col" aria-sort={ariaSort("spread")}><button type="button" onclick={() => toggleSort("spread")}>{detail.weaponSpread}</button></th>
                    <th scope="col" aria-sort={ariaSort("splashRadius")}><button type="button" onclick={() => toggleSort("splashRadius")}>{detail.weaponSplash}</button></th>
                    <th scope="col" aria-sort={ariaSort("stunDuration")}><button type="button" onclick={() => toggleSort("stunDuration")}>{detail.weaponStun}</button></th>
                  </tr>
                </thead>
                <tbody>
                  {#each weapons as weapon, index (index)}
                    <tr>
                      <td class="weapon-table__name">{weapon.name}</td>
                      <td class="weapon-table__main">{weapon.mainDps ? "✓" : "—"}</td>
                      <td>{weapon.count}</td>
                      <td>{weapon.projectileCount ?? 1}</td>
                      <td>{formatter.format(weapon.projectileDelay ?? 0)}{detail.seconds}</td>
                      <td>{formatter.format(weapon.damage)}</td>
                      <td>{formatter.format(weapon.fireDelay)}{detail.seconds}</td>
                      <td>{weapon.armourIgnoreAmount !== undefined ? formatter.format(weapon.armourIgnoreAmount) : "—"}</td>
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
                      <td>{weapon.stunDuration !== undefined ? `${formatter.format(weapon.stunDuration)}${detail.seconds}` : "—"}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>

        {#if item.builder}
          <section class="detail-section">
            <h3>{detail.builder}</h3>
            <div class="detail-stats detail-stats--builder">
              <div><span>{detail.builderBuildRange}</span><b>{number(item.builder.buildRange)}</b></div>
              <div><span>{detail.builderRepairSpeed}</span><b>{number(item.builder.repairSpeed)}</b></div>
              <div><span>{detail.builderBuildSpeed}</span><b>{number(item.builder.buildSpeed)}</b></div>
              <div class="detail-stats__wide"><span>{detail.builderHeals}</span><b>{item.builder.healTags.length ? item.builder.healTags.map(tagName).join(", ") : "—"}</b></div>
            </div>
          </section>
        {/if}

        {#if item.factories.length > 0}
          <section class="detail-section">
            <h3>{detail.factories} <span class="detail-section__count">{item.factories.length}</span></h3>
            <div class="detail-cards">
              {#each item.factories as factory, index (factory.name + index)}
                <article class="detail-card">
                  <div class="detail-card__head">
                    <b>{factory.name}</b>
                    <span class="badge">{detail.factorySpeed}: ×{formatter.format(factory.buildSpeed)}</span>
                  </div>
                  <div class="detail-card__label">{detail.factoryUnits}</div>
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
            <h3>{detail.transports} <span class="detail-section__count">{item.transports.length}</span></h3>
            <div class="detail-cards">
              {#each item.transports as transport, index (transport.name + index)}
                <article class="detail-card">
                  <div class="detail-card__head">
                    <b>{transport.name}</b>
                    <span class="badge">{detail.transportSeats}: {transport.seats}</span>
                  </div>
                  <div class="detail-card__label">{detail.transportCargo}</div>
                  <div class="weapon-table__tags">
                    {#each transport.cargoTags as id (id)}<span class="chip chip--tag">{tagName(id)}</span>{/each}
                    {#if transport.cargoTags.length === 0}—{/if}
                  </div>
                  <div class="detail-card__label">{detail.transportUnload}</div>
                  <div class="detail-unload">
                    {#each transport.unload as option (option)}
                      <span class="chip">{unloadLabels[option] ?? detail.unloadShore}</span>
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
          {compared ? detail.removeCompare : detail.addCompare}
        </button>
        <button class="btn btn--ghost btn--sm" type="button" onclick={onclose}>
          {detail.close}
        </button>
      </footer>
    </div>
  {/if}
</dialog>
