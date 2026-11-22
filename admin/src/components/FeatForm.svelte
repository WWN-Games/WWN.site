<script lang="ts">
  import { onMount } from "svelte";

  import { addMonthsIso, todayIso } from "../../shared/date";
  import type { Card, FeatItem, RatingEntry, ToastFn } from "../../shared/types";
  import { api } from "../lib/api";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";
  import UnitPicker from "./UnitPicker.svelte";

  interface Props {
    item: FeatItem;
    toast: ToastFn;
  }

  const { item = $bindable(), toast }: Props = $props();

  let unitOptions = $state<Card[]>([]);
  let ratings = $state<RatingEntry[]>([]);

  onMount(async () => {
    try {
      const [unitsResponse, ratingsResponse] = await Promise.all([
        api.get<{ items: Card[] }>("/api/collections/units"),
        api.get<{ items: RatingEntry[] }>("/api/collections/ratings"),
      ]);
      unitOptions = unitsResponse.items;
      ratings = ratingsResponse.items;
    } catch {
      unitOptions = [];
      ratings = [];
    }
  });

  const selectedUnits = $derived(
    (item.unitIds ?? []).flatMap((id) => {
      const unit = unitOptions.find((entry) => entry.id === id);
      return unit ? [unit] : [];
    }),
  );
  const autoCost = $derived(
    selectedUnits.reduce((sum, unit) => sum + unit.cost + Math.max(0, unit.energy) / 4, 0),
  );

  function toggleNew(checked: boolean): void {
    item.new = checked;
    item.newUntil = checked ? (item.newUntil ?? addMonthsIso(todayIso(), 2)) : undefined;
  }
</script>

<div class="form-section">
  <div class="form-section__title">Подвиг</div>
  <div class="form-grid form-grid--four">
    <div class="field">
      <label for="feat-id">ID</label>
      <input id="feat-id" value={item.id} spellcheck="false" placeholder="first-victory" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="feat-order">Порядок</label>
      <input id="feat-order" type="number" min="0" value={item.order} oninput={(event) => (item.order = Math.max(0, Math.round(Number(event.currentTarget.value) || 0)))} />
    </div>
    <div class="field">
      <label for="feat-date">Дата</label>
      <input id="feat-date" type="date" value={item.date ?? ""} oninput={(event) => (item.date = event.currentTarget.value || undefined)} />
    </div>
    <div class="field">
      <label for="feat-type">Тип подвига</label>
      <select id="feat-type" value={item.type ?? "unit"} onchange={(event) => (item.type = event.currentTarget.value as "unit" | "battle")}>
        <option value="unit">Юнит</option>
        <option value="battle">Битва</option>
      </select>
    </div>
  </div>
  <LocalizedInput label="Название" value={item.name} placeholder="Первая победа" />
  <LocalizedInput label="Информация" value={item.desc} multiline rows={4} placeholder="Что произошло" />
</div>

<div class="form-section">
  <div class="form-section__title">Командир</div>
  <div class="field">
    <label for="feat-commander">Запись рейтинга</label>
    <select
      id="feat-commander"
      value={item.commanderId ?? ""}
      onchange={(event) => (item.commanderId = event.currentTarget.value || undefined)}
    >
      <option value="">— не указан —</option>
      {#each ratings as rating}
        <option value={rating.id}>{rating.nickname} · {rating.id}</option>
      {/each}
    </select>
    {#if ratings.length === 0}
      <span class="field__hint">Рейтинг пуст — сначала добавьте запись в разделе «Рейтинг».</span>
    {/if}
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Юниты и боевой номер</div>
  <div class="field">
    <span class="field__label">Связанные юниты</span>
    <UnitPicker
      selected={item.unitIds ?? []}
      units={unitOptions}
      onchange={(ids) => (item.unitIds = ids)}
    />
  </div>
  {#if item.type !== "battle"}
    <div class="form-grid form-grid--three">
      <div class="field">
        <label for="feat-cost">Цена</label>
        <input
          id="feat-cost"
          type="number"
          min="0"
          step="any"
          value={item.cost ?? ""}
          placeholder={autoCost > 0 ? String(autoCost) : "—"}
          oninput={(event) => (item.cost = event.currentTarget.value === "" ? undefined : Math.max(0, Number(event.currentTarget.value)))}
        />
        <span class="field__hint">Пусто — авто из юнитов: {autoCost || 0} (полная стоимость).</span>
      </div>
      <div class="field">
        <label for="feat-destroyed-cost">Цена уничтоженных</label>
        <input
          id="feat-destroyed-cost"
          type="number"
          min="0"
          step="any"
          value={item.destroyedCost ?? ""}
          placeholder="—"
          oninput={(event) => (item.destroyedCost = event.currentTarget.value === "" ? undefined : Math.max(0, Number(event.currentTarget.value)))}
        />
      </div>
      <div class="field">
        <label for="feat-destroyed-count">Уничтожено юнитов</label>
        <input
          id="feat-destroyed-count"
          type="number"
          min="0"
          step="1"
          value={item.destroyedCount ?? ""}
          placeholder="—"
          oninput={(event) => (item.destroyedCount = event.currentTarget.value === "" ? undefined : Math.max(0, Math.round(Number(event.currentTarget.value))))}
        />
      </div>
    </div>
  {:else}
    <div class="form-grid form-grid--four">
      <div class="field">
        <label for="feat-hero-cost">Потери героев, стоимость</label>
        <input
          id="feat-hero-cost"
          type="number"
          min="0"
          step="any"
          value={item.heroLossCost ?? ""}
          placeholder="—"
          oninput={(event) => (item.heroLossCost = event.currentTarget.value === "" ? undefined : Math.max(0, Number(event.currentTarget.value)))}
        />
      </div>
      <div class="field">
        <label for="feat-hero-count">Потеряно юнитов героев</label>
        <input
          id="feat-hero-count"
          type="number"
          min="0"
          step="1"
          value={item.heroLossCount ?? ""}
          placeholder="—"
          oninput={(event) => (item.heroLossCount = event.currentTarget.value === "" ? undefined : Math.max(0, Math.round(Number(event.currentTarget.value))))}
        />
      </div>
      <div class="field">
        <label for="feat-enemy-cost">Потери противников, стоимость</label>
        <input
          id="feat-enemy-cost"
          type="number"
          min="0"
          step="any"
          value={item.enemyLossCost ?? ""}
          placeholder="—"
          oninput={(event) => (item.enemyLossCost = event.currentTarget.value === "" ? undefined : Math.max(0, Number(event.currentTarget.value)))}
        />
      </div>
      <div class="field">
        <label for="feat-enemy-count">Потеряно юнитов противников</label>
        <input
          id="feat-enemy-count"
          type="number"
          min="0"
          step="1"
          value={item.enemyLossCount ?? ""}
          placeholder="—"
          oninput={(event) => (item.enemyLossCount = event.currentTarget.value === "" ? undefined : Math.max(0, Math.round(Number(event.currentTarget.value))))}
        />
      </div>
    </div>
  {/if}
  <div class="field">
    <label for="feat-combat-number">Боевой номер юнита/ов</label>
    <input
      id="feat-combat-number"
      value={item.combatNumber ?? ""}
      placeholder="Например: БК-042"
      oninput={(event) => (item.combatNumber = event.currentTarget.value || undefined)}
    />
  </div>
</div>

<div class="form-section">
  <div class="form-section__title">Изображение</div>
  <ImagePicker kind="feat" id={item.id} path={item.image} label="Картинка подвига" {toast} onchange={(path) => (item.image = path)} />
  <div class="field" style="margin-top: 12px">
    <label class="tag-option" style="padding: 6px 0">
      <input type="checkbox" checked={item.new ?? false} onchange={(event) => toggleNew(event.currentTarget.checked)} />
      <span>Новинка! — золотая плашка</span>
    </label>
    {#if item.new}
      <div class="field">
        <label for="feat-new-until">Показывать до</label>
        <input id="feat-new-until" type="date" value={item.newUntil ?? ""} oninput={(event) => (item.newUntil = event.currentTarget.value || undefined)} />
      </div>
    {/if}
  </div>
</div>
