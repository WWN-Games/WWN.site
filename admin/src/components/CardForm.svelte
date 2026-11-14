<script lang="ts">
  import { onMount } from "svelte";
  import { weaponDps } from "../../../src/lib/card-stats";
  import { UNLOAD_OPTIONS, type UnloadOption } from "../../../src/lib/content-constants";
  import { addMonthsIso, todayIso } from "../../shared/date";
  import type { Bootstrap, Card, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";
  import TagPicker from "./TagPicker.svelte";
  import UnitPicker from "./UnitPicker.svelte";

  interface Props {
    name: "units" | "buildings" | "misc";
    item: Card;
    bootstrap: Bootstrap;
    toast: ToastFn;
  }

  const { name, item = $bindable(), bootstrap, toast }: Props = $props();

  const isUnit = $derived(name === "units");
  const weapons = $derived(item.weapons ?? []);
  const factories = $derived(item.factories ?? []);
  const transports = $derived(item.transports ?? []);
  const computedDps = $derived(
    weapons.reduce((sum, weapon) => sum + weaponDps(weapon), 0),
  );

  let unitOptions = $state<Card[]>([]);

  onMount(async () => {
    try {
      const response = await api.get<{ items: Card[] }>("/api/collections/units");
      unitOptions = response.items;
    } catch {
      unitOptions = [];
    }
  });

  const unloadLabels: Record<UnloadOption, string> = {
    shore: "Берег",
    water: "Вода",
    air: "Воздух",
    underwater: "Под водой",
    space: "Космос",
  };

  function updateRole(lang: "ru" | "en", value: string): void {
    const current = item.role ?? { ru: "", en: "" };
    const next = { ...current, [lang]: value };
    item.role = next.ru || next.en ? next : undefined;
  }

  function addWeapon(): void {
    item.weapons = [
      ...weapons,
      {
        name: { ru: "", en: "" },
        count: 1,
        projectileCount: 1,
        projectileDelay: 0,
        damage: 0,
        fireDelay: 1,
        tags: [],
      },
    ];
  }

  function removeWeapon(index: number): void {
    item.weapons = weapons.filter((_, position) => position !== index);
  }

  function updateWeapon(index: number, patch: Partial<(typeof weapons)[number]>): void {
    item.weapons = weapons.map((weapon, position) =>
      position === index ? { ...weapon, ...patch } : weapon,
    );
  }

  function updateWeaponTags(index: number, tags: string[]): void {
    updateWeapon(index, { tags });
  }

  function numberValue(key: keyof Card): string {
    const value = item[key];
    return typeof value === "number" ? String(value) : "";
  }

  function setNumber(key: keyof Card, value: string, fallback = 0): void {
    item[key] = (value === "" ? fallback : Number(value)) as never;
  }

  function setOptionalNumber(key: keyof Card, value: string): void {
    item[key] = (value === "" ? undefined : Number(value)) as never;
  }

  function toggleNew(checked: boolean): void {
    item.new = checked;
    item.newUntil = checked ? (item.newUntil ?? addMonthsIso(todayIso(), 2)) : undefined;
  }

  function toggleMissileDefense(checked: boolean): void {
    item.missileDefense = checked ? (item.missileDefense ?? { max: 0, recharge: 0 }) : undefined;
  }

  function toggleTorpedoDefense(checked: boolean): void {
    item.torpedoDefense = checked ? (item.torpedoDefense ?? { max: 0, recharge: 0 }) : undefined;
  }

  function toggleDomeShield(checked: boolean): void {
    item.domeShield = checked
      ? (item.domeShield ?? { radius: 0, points: 0, regen: 0 })
      : undefined;
  }

  function toggleAtmosphere(checked: boolean): void {
    item.atmosphere = checked ? (item.atmosphere ?? { time: 0 }) : undefined;
  }

  function toggleFtlJump(checked: boolean): void {
    item.ftlJump = checked
      ? (item.ftlJump ?? {
          type: "siv",
          chargeTime: 0,
          cooldown: 0,
          minDistance: 0,
        })
      : undefined;
  }

  function updateChargeDefense(
    key: "missileDefense" | "torpedoDefense",
    patch: Partial<{ max: number; recharge: number }>,
  ): void {
    const current = item[key];
    if (!current) return;
    item[key] = { ...current, ...patch };
  }

  function updateDomeShield(patch: Partial<{ radius: number; points: number; regen: number }>): void {
    if (!item.domeShield) return;
    item.domeShield = { ...item.domeShield, ...patch };
  }

  function updateAtmosphere(time: number): void {
    if (!item.atmosphere) return;
    item.atmosphere = { ...item.atmosphere, time };
  }

  function updateFtlJump(
    patch: Partial<{
      type: "siv" | "plasma";
      chargeTime: number;
      cooldown: number;
      minDistance: number;
      energyCost: number | undefined;
    }>,
  ): void {
    if (!item.ftlJump) return;
    item.ftlJump = { ...item.ftlJump, ...patch };
  }

  function toggleBuilder(checked: boolean): void {
    item.builder = checked
      ? { buildRange: 0, repairSpeed: 0, buildSpeed: 0, healTags: [] }
      : undefined;
  }

  function updateBuilderNumber(
    key: "buildRange" | "repairSpeed" | "buildSpeed",
    value: string,
  ): void {
    if (!item.builder) return;
    item.builder = { ...item.builder, [key]: Number(value) || 0 };
  }

  function updateBuilderHealTags(ids: string[]): void {
    if (!item.builder) return;
    item.builder = { ...item.builder, healTags: ids };
  }

  function addFactory(): void {
    item.factories = [
      ...factories,
      { name: { ru: "", en: "" }, buildSpeed: 1, producedUnits: [] },
    ];
  }

  function removeFactory(index: number): void {
    item.factories = factories.filter((_, position) => position !== index);
  }

  function updateFactory(index: number, patch: Partial<(typeof factories)[number]>): void {
    item.factories = factories.map((factory, position) =>
      position === index ? { ...factory, ...patch } : factory,
    );
  }

  function addTransport(): void {
    item.transports = [
      ...transports,
      { name: { ru: "", en: "" }, seats: 0, cargoTags: [], unload: [] },
    ];
  }

  function removeTransport(index: number): void {
    item.transports = transports.filter((_, position) => position !== index);
  }

  function updateTransport(index: number, patch: Partial<(typeof transports)[number]>): void {
    item.transports = transports.map((transport, position) =>
      position === index ? { ...transport, ...patch } : transport,
    );
  }

  function toggleUnload(index: number, option: UnloadOption): void {
    const transport = transports[index];
    if (!transport) return;
    const unload = transport.unload.includes(option)
      ? transport.unload.filter((item) => item !== option)
      : [...transport.unload, option];
    updateTransport(index, { unload });
  }
</script>

<div class="form-section">
  <div class="form-section__title">Идентификация <span>id, фракция</span></div>
  <div class="form-grid">
    <div class="field">
      <label for="card-id">ID</label>
      <input
        id="card-id"
        value={item.id}
        spellcheck="false"
        placeholder="ahaosa"
        oninput={(event) => (item.id = event.currentTarget.value)}
      />
      <span class="field__hint">Латиница, цифры, дефис. Меняется и имя картинки по умолчанию.</span>
    </div>
    <div class="field">
      <label for="card-faction">Фракция</label>
      <select
        id="card-faction"
        value={item.faction}
        onchange={(event) => (item.faction = event.currentTarget.value)}
      >
        {#each bootstrap.factions as faction}
          <option value={faction.id}>{faction.name.ru} · {faction.id}</option>
        {/each}
      </select>
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Текст <span>RU — источник истины, EN обязателен</span></div>
  <LocalizedInput label="Название" value={item.name} placeholder="Лодка ПВО" />
  <LocalizedInput label="Описание" value={item.desc} multiline rows={3} placeholder="Короткое описание карточки" />
</div>

<div class="form-section">
  <div class="form-section__title">
    Вооружение
    <span>{weapons.length} шт. · DPS {computedDps.toFixed(2)}</span>
  </div>
  {#if weapons.length === 0}
    <p class="field__hint">Орудий нет — DPS карточки будет 0.</p>
  {/if}
  {#each weapons as weapon, index (index)}
    {@const hasSplash = weapon.tags.includes("splash")}
    {@const hasStun = weapon.tags.includes("stun")}
    <div class="weapon-card">
      <div class="weapon-card__head">
        <b>Орудие {index + 1} · DPS {weaponDps(weapon).toFixed(2)}</b>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => removeWeapon(index)}>
          Удалить
        </button>
      </div>
      <LocalizedInput label="Название орудия" value={weapon.name} placeholder="Например: Главный калибр" />
      <div class="form-grid form-grid--four">
        <div class="field">
          <label for={`weapon-${index}-count`}>Количество одинаковых</label>
          <input
            id={`weapon-${index}-count`}
            type="number"
            min="1"
            step="1"
            value={weapon.count}
            oninput={(event) => updateWeapon(index, { count: Math.max(1, Number(event.currentTarget.value) || 1) })}
          />
        </div>
        <div class="field">
          <label for={`weapon-${index}-projectiles`}>Снарядов за выстрел</label>
          <input
            id={`weapon-${index}-projectiles`}
            type="number"
            min="1"
            step="1"
            value={weapon.projectileCount}
            oninput={(event) => updateWeapon(index, { projectileCount: Math.max(1, Number(event.currentTarget.value) || 1) })}
          />
        </div>
        <div class="field">
          <label for={`weapon-${index}-projectile-delay`}>Интервал между снарядами, с</label>
          <input
            id={`weapon-${index}-projectile-delay`}
            type="number"
            min="0"
            step="any"
            value={weapon.projectileDelay}
            oninput={(event) => updateWeapon(index, { projectileDelay: Number(event.currentTarget.value) || 0 })}
          />
        </div>
        <div class="field">
          <label for={`weapon-${index}-damage`}>Урон одного снаряда</label>
          <input
            id={`weapon-${index}-damage`}
            type="number"
            min="0"
            step="any"
            value={weapon.damage}
            oninput={(event) => updateWeapon(index, { damage: Number(event.currentTarget.value) || 0 })}
          />
        </div>
        <div class="field">
          <label for={`weapon-${index}-delay`}>Задержка между выстрелами, с</label>
          <input
            id={`weapon-${index}-delay`}
            type="number"
            min="0.001"
            step="any"
            value={weapon.fireDelay}
            oninput={(event) => updateWeapon(index, { fireDelay: Number(event.currentTarget.value) || 0.001 })}
          />
        </div>
        <div class="field">
          <label for={`weapon-${index}-armour`}>Бронебойность</label>
          <input
            id={`weapon-${index}-armour`}
            type="number"
            min="0"
            step="any"
            value={weapon.armourIgnoreAmount ?? ""}
            placeholder="—"
            oninput={(event) => updateWeapon(index, { armourIgnoreAmount: event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value) })}
          />
        </div>
      </div>
      <div class="field">
        <span class="field__label">Теги орудия</span>
        <TagPicker
          selected={weapon.tags}
          available={bootstrap.tags}
          groups={["weapon", "sector"] as const}
          onchange={(ids) => updateWeaponTags(index, ids)}
        />
      </div>
      {#if hasSplash || hasStun}
        <div class="form-grid form-grid--two">
          {#if hasSplash}
            <div class="field">
              <label for={`weapon-${index}-spread`}>Разброс</label>
              <input
                id={`weapon-${index}-spread`}
                type="number"
                min="0"
                step="any"
                value={weapon.spread ?? ""}
                placeholder="—"
                oninput={(event) => updateWeapon(index, { spread: event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value) })}
              />
            </div>
            <div class="field">
              <label for={`weapon-${index}-splash`}>Радиус сплеша</label>
              <input
                id={`weapon-${index}-splash`}
                type="number"
                min="0"
                step="any"
                value={weapon.splashRadius ?? ""}
                placeholder="—"
                oninput={(event) => updateWeapon(index, { splashRadius: event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value) })}
              />
            </div>
          {/if}
          {#if hasStun}
            <div class="field">
              <label for={`weapon-${index}-stun`}>Длительность стана, с</label>
              <input
                id={`weapon-${index}-stun`}
                type="number"
                min="0"
                step="any"
                value={weapon.stunDuration ?? ""}
                placeholder="—"
                oninput={(event) => updateWeapon(index, { stunDuration: event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value) })}
              />
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
  <div>
    <button class="btn btn--ghost btn--small" type="button" onclick={addWeapon}>
      Добавить орудие
    </button>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Характеристики</div>
  <div class="form-grid form-grid--four">
    <div class="field">
      <label for="card-cost">Цена</label>
      <input id="card-cost" type="number" step="any" value={numberValue("cost")} oninput={(event) => setNumber("cost", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-energy">Энергия</label>
      <input id="card-energy" type="number" step="any" min="0" value={numberValue("energy")} oninput={(event) => setNumber("energy", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-hp">HP</label>
      <input id="card-hp" type="number" step="any" value={numberValue("hp")} oninput={(event) => setNumber("hp", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-build">Время постройки, с (×1)</label>
      <input id="card-build" type="number" step="any" value={numberValue("buildTime")} oninput={(event) => setNumber("buildTime", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-shield">Щит</label>
      <input id="card-shield" type="number" step="any" value={numberValue("shield")} placeholder="—" oninput={(event) => setOptionalNumber("shield", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-armor">Броня</label>
      <input id="card-armor" type="number" step="any" value={numberValue("armor")} placeholder="—" oninput={(event) => setOptionalNumber("armor", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-self-regen">Реген</label>
      <input id="card-self-regen" type="number" step="any" value={numberValue("selfRegen")} placeholder="—" oninput={(event) => setOptionalNumber("selfRegen", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-shield-regen">Реген щита</label>
      <input id="card-shield-regen" type="number" step="any" value={numberValue("shieldRegen")} placeholder="—" oninput={(event) => setOptionalNumber("shieldRegen", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-dps">DPS</label>
      <input id="card-dps" value={computedDps.toFixed(2)} readonly />
      <span class="field__hint">count × снарядов × урон / задержка</span>
    </div>
    <div class="field">
      <label for="card-speed">Скорость</label>
      <input id="card-speed" type="number" step="any" value={numberValue("speed")} placeholder="—" oninput={(event) => setOptionalNumber("speed", event.currentTarget.value)} />
    </div>
    {#if isUnit}
      <div class="field">
        <label for="card-turn-speed">Скорость поворота</label>
        <input id="card-turn-speed" type="number" step="any" value={numberValue("turnSpeed")} placeholder="—" oninput={(event) => setOptionalNumber("turnSpeed", event.currentTarget.value)} />
      </div>
    {/if}
    <div class="field">
      <label for="card-range">Дальность</label>
      <input id="card-range" type="number" step="any" value={numberValue("range")} placeholder="—" oninput={(event) => setOptionalNumber("range", event.currentTarget.value)} />
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Способности <span>необязательно</span></div>
  <div class="form-grid form-grid--two">
    <div class="field">
      <label class="tag-option" style="padding: 6px 0">
        <input type="checkbox" checked={!!item.missileDefense} onchange={(event) => toggleMissileDefense(event.currentTarget.checked)} />
        <span>Защита от ракет</span>
      </label>
      {#if item.missileDefense}
        <div class="form-grid form-grid--two">
          <div class="field">
            <label for="missile-max">Макс. зарядов</label>
            <input id="missile-max" type="number" min="0" step="1" value={item.missileDefense.max} oninput={(event) => updateChargeDefense("missileDefense", { max: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)) })} />
          </div>
          <div class="field">
            <label for="missile-recharge">Восстановление, зарядов/с</label>
            <input id="missile-recharge" type="number" min="0" step="any" value={item.missileDefense.recharge} oninput={(event) => updateChargeDefense("missileDefense", { recharge: Number(event.currentTarget.value) || 0 })} />
          </div>
        </div>
      {/if}
    </div>
    <div class="field">
      <label class="tag-option" style="padding: 6px 0">
        <input type="checkbox" checked={!!item.torpedoDefense} onchange={(event) => toggleTorpedoDefense(event.currentTarget.checked)} />
        <span>Защита от торпед</span>
      </label>
      {#if item.torpedoDefense}
        <div class="form-grid form-grid--two">
          <div class="field">
            <label for="torpedo-max">Макс. зарядов</label>
            <input id="torpedo-max" type="number" min="0" step="1" value={item.torpedoDefense.max} oninput={(event) => updateChargeDefense("torpedoDefense", { max: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)) })} />
          </div>
          <div class="field">
            <label for="torpedo-recharge">Восстановление, зарядов/с</label>
            <input id="torpedo-recharge" type="number" min="0" step="any" value={item.torpedoDefense.recharge} oninput={(event) => updateChargeDefense("torpedoDefense", { recharge: Number(event.currentTarget.value) || 0 })} />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={item.laserDefense ?? false} onchange={(event) => (item.laserDefense = event.currentTarget.checked)} />
    <span>Лазерная защита</span>
  </label>

  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={!!item.domeShield} onchange={(event) => toggleDomeShield(event.currentTarget.checked)} />
    <span>Купольный щит</span>
  </label>
  {#if item.domeShield}
    <div class="form-grid form-grid--three">
      <div class="field">
        <label for="dome-radius">Радиус</label>
        <input id="dome-radius" type="number" min="0" step="any" value={item.domeShield.radius} oninput={(event) => updateDomeShield({ radius: Number(event.currentTarget.value) || 0 })} />
      </div>
      <div class="field">
        <label for="dome-points">Очков защиты</label>
        <input id="dome-points" type="number" min="0" step="any" value={item.domeShield.points} oninput={(event) => updateDomeShield({ points: Number(event.currentTarget.value) || 0 })} />
      </div>
      <div class="field">
        <label for="dome-regen">Восстановление, очков/с</label>
        <input id="dome-regen" type="number" min="0" step="any" value={item.domeShield.regen} oninput={(event) => updateDomeShield({ regen: Number(event.currentTarget.value) || 0 })} />
      </div>
    </div>
  {/if}

  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={!!item.atmosphere} onchange={(event) => toggleAtmosphere(event.currentTarget.checked)} />
    <span>Способен входить в атмосферу</span>
  </label>
  {#if item.atmosphere}
    <div class="field">
      <label for="atmosphere-time">Время входа, с</label>
      <input id="atmosphere-time" type="number" min="0" step="any" value={item.atmosphere.time} oninput={(event) => updateAtmosphere(Number(event.currentTarget.value) || 0)} />
    </div>
  {/if}

  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={!!item.ftlJump} onchange={(event) => toggleFtlJump(event.currentTarget.checked)} />
    <span>Сверхсветовой прыжок</span>
  </label>
  {#if item.ftlJump}
    <div class="form-grid form-grid--three">
      <div class="field">
        <label for="ftl-type">Тип</label>
        <select id="ftl-type" value={item.ftlJump.type} onchange={(event) => updateFtlJump({ type: event.currentTarget.value as "siv" | "plasma" })}>
          <option value="siv">СИВ</option>
          <option value="plasma">Плазма</option>
        </select>
      </div>
      <div class="field">
        <label for="ftl-charge">Зарядка, с</label>
        <input id="ftl-charge" type="number" min="0" step="any" value={item.ftlJump.chargeTime} oninput={(event) => updateFtlJump({ chargeTime: Number(event.currentTarget.value) || 0 })} />
      </div>
      <div class="field">
        <label for="ftl-cooldown">Перезарядка, с</label>
        <input id="ftl-cooldown" type="number" min="0" step="any" value={item.ftlJump.cooldown} oninput={(event) => updateFtlJump({ cooldown: Number(event.currentTarget.value) || 0 })} />
      </div>
      <div class="field">
        <label for="ftl-min">Мин. дистанция</label>
        <input id="ftl-min" type="number" min="0" step="any" value={item.ftlJump.minDistance} oninput={(event) => updateFtlJump({ minDistance: Number(event.currentTarget.value) || 0 })} />
      </div>
      {#if item.ftlJump.type === "plasma"}
        <div class="field">
          <label for="ftl-energy">Стоимость энергии</label>
          <input id="ftl-energy" type="number" min="0" step="any" value={item.ftlJump.energyCost ?? ""} placeholder="—" oninput={(event) => updateFtlJump({ energyCost: event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value) })} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<div class="form-section">
  <div class="form-section__title">Строитель <span>для юнитов и строений</span></div>
  <label class="tag-option" style="padding: 6px 0">
    <input type="checkbox" checked={!!item.builder} onchange={(event) => toggleBuilder(event.currentTarget.checked)} />
    <span>Карточка умеет строить и/или лечить</span>
  </label>
  {#if item.builder}
    <div class="form-grid form-grid--three">
      <div class="field">
        <label for="builder-range">Дальность строительства</label>
        <input id="builder-range" type="number" step="any" value={item.builder.buildRange} oninput={(event) => updateBuilderNumber("buildRange", event.currentTarget.value)} />
      </div>
      <div class="field">
        <label for="builder-repair">Скорость починки</label>
        <input id="builder-repair" type="number" step="any" value={item.builder.repairSpeed} oninput={(event) => updateBuilderNumber("repairSpeed", event.currentTarget.value)} />
      </div>
      <div class="field">
        <label for="builder-build">Скорость строительства</label>
        <input id="builder-build" type="number" step="any" value={item.builder.buildSpeed} oninput={(event) => updateBuilderNumber("buildSpeed", event.currentTarget.value)} />
      </div>
    </div>
    <div class="field">
      <span class="field__label">Кого лечит</span>
      <TagPicker
        selected={item.builder.healTags}
        available={bootstrap.tags}
        onchange={updateBuilderHealTags}
      />
    </div>
  {/if}
</div>

<div class="form-section">
  <div class="form-section__title">Заводы <span>производят только юнитов</span></div>
  {#if factories.length === 0}
    <p class="field__hint">Заводов нет.</p>
  {/if}
  {#each factories as factory, index (index)}
    <div class="weapon-card">
      <div class="weapon-card__head">
        <b>Завод {index + 1}</b>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => removeFactory(index)}>
          Удалить
        </button>
      </div>
      <LocalizedInput label="Название завода" value={factory.name} placeholder="Например: Аэродром" />
      <div class="field">
        <label for={`factory-${index}-speed`}>Скорость производства</label>
        <input
          id={`factory-${index}-speed`}
          type="number"
          min="0.01"
          step="any"
          value={factory.buildSpeed}
          oninput={(event) => updateFactory(index, { buildSpeed: Number(event.currentTarget.value) || 1 })}
        />
        <span class="field__hint">Множитель: 1, 1.23 или любое своё значение.</span>
      </div>
      <div class="field">
        <span class="field__label">Производимые юниты</span>
        <UnitPicker
          selected={factory.producedUnits}
          units={unitOptions}
          onchange={(ids) => updateFactory(index, { producedUnits: ids })}
        />
      </div>
    </div>
  {/each}
  <div>
    <button class="btn btn--ghost btn--small" type="button" onclick={addFactory}>
      Добавить завод
    </button>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Транспорт <span>отделения</span></div>
  {#if transports.length === 0}
    <p class="field__hint">Транспортных отделений нет.</p>
  {/if}
  {#each transports as transport, index (index)}
    <div class="weapon-card">
      <div class="weapon-card__head">
        <b>Отделение {index + 1}</b>
        <button class="btn btn--ghost btn--small" type="button" onclick={() => removeTransport(index)}>
          Удалить
        </button>
      </div>
      <LocalizedInput label="Название отделения" value={transport.name} placeholder="Например: Трюм" />
      <div class="field">
        <label for={`transport-${index}-seats`}>Мест</label>
        <input
          id={`transport-${index}-seats`}
          type="number"
          min="0"
          step="1"
          value={transport.seats}
          oninput={(event) => updateTransport(index, { seats: Math.max(0, Math.round(Number(event.currentTarget.value) || 0)) })}
        />
      </div>
      <div class="field">
        <span class="field__label">Кого перевозит</span>
        <TagPicker
          selected={transport.cargoTags}
          available={bootstrap.tags}
          onchange={(ids) => updateTransport(index, { cargoTags: ids })}
        />
      </div>
      <div class="field">
        <span class="field__label">Выгрузка на</span>
        <div class="tag-picker__panel">
          {#each UNLOAD_OPTIONS as option (option)}
            <label class="tag-option">
              <input
                type="checkbox"
                checked={transport.unload.includes(option)}
                onchange={() => toggleUnload(index, option)}
              />
              <span>{unloadLabels[option]}</span>
              <span class="badge" style="margin-left: auto">{option}</span>
            </label>
          {/each}
        </div>
      </div>
    </div>
  {/each}
  <div>
    <button class="btn btn--ghost btn--small" type="button" onclick={addTransport}>
      Добавить транспортное отделение
    </button>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Роль <span>необязательно</span></div>
  <div class="form-grid">
    <div class="field">
      <label for="card-role-ru">Роль · RU</label>
      <input
        id="card-role-ru"
        value={item.role?.ru ?? ""}
        placeholder="Например: ПВО / поддержка"
        oninput={(event) => updateRole("ru", event.currentTarget.value)}
      />
    </div>
    <div class="field">
      <label for="card-role-en">Роль · EN</label>
      <input
        id="card-role-en"
        value={item.role?.en ?? ""}
        placeholder="AA / support"
        oninput={(event) => updateRole("en", event.currentTarget.value)}
      />
    </div>
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Теги</div>
  <TagPicker selected={item.tags} available={bootstrap.tags} onchange={(ids) => (item.tags = ids)} />
</div>

<div class="form-section">
  <div class="form-section__title">Изображение</div>
  <div class="form-grid">
    <div class="field">
      <ImagePicker
        kind="card"
        id={item.id}
        path={item.image}
        label="Картинка карточки"
        {toast}
        onchange={(path) => (item.image = path)}
      />
    </div>
    <div class="field">
      <span class="field__label">Флаги</span>
      <label class="tag-option" style="padding: 6px 0">
        <input type="checkbox" checked={item.draft ?? false} onchange={(event) => (item.draft = event.currentTarget.checked)} />
        <span>Черновик — показать бейдж «Черновик»</span>
      </label>
      <label class="tag-option" style="padding: 6px 0">
        <input type="checkbox" checked={item.new ?? false} onchange={(event) => toggleNew(event.currentTarget.checked)} />
        <span>Новинка! — золотая плашка</span>
      </label>
      {#if item.new}
        <div class="field">
          <label for="card-new-until">Показывать до</label>
          <input
            id="card-new-until"
            type="date"
            value={item.newUntil ?? ""}
            oninput={(event) => (item.newUntil = event.currentTarget.value || undefined)}
          />
          <span class="field__hint">По умолчанию +2 месяца; плашка исчезает по дате.</span>
        </div>
      {/if}
      <p class="field__hint" style="margin-top: 8px">
        <code>public/img/database</code>
      </p>
    </div>
  </div>
</div>
