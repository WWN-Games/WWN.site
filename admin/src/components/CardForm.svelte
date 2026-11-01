<script lang="ts">
  import type { Bootstrap, Card, ToastFn } from "../../shared/types";
  import ImagePicker from "./ImagePicker.svelte";
  import LocalizedInput from "./LocalizedInput.svelte";
  import TagPicker from "./TagPicker.svelte";

  interface Props {
    name: "units" | "buildings";
    item: Card;
    bootstrap: Bootstrap;
    toast: ToastFn;
  }

  const { name, item = $bindable(), bootstrap, toast }: Props = $props();

  const isUnit = $derived(name === "units");
  const typeOptions = $derived(
    isUnit
      ? [
          { value: "ground", label: "Наземный" },
          { value: "air", label: "Воздушный" },
          { value: "naval", label: "Морской" },
          { value: "space", label: "Космический" },
          { value: "support", label: "Поддержка" },
        ]
      : [
          { value: "economy", label: "Экономика" },
          { value: "defense", label: "Оборона" },
          { value: "structure", label: "Строение" },
        ],
  );

  function updateRole(lang: "ru" | "en", value: string): void {
    const current = item.role ?? { ru: "", en: "" };
    const next = { ...current, [lang]: value };
    item.role = next.ru || next.en ? next : undefined;
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
</script>

<div class="form-section">
  <div class="form-section__title">Идентификация <span>id, фракция, тип</span></div>
  <div class="form-grid form-grid--three">
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
    <div class="field">
      <label for="card-type">Тип</label>
      <select
        id="card-type"
        value={item.type}
        onchange={(event) => (item.type = event.currentTarget.value)}
      >
        {#each typeOptions as option}
          <option value={option.value}>{option.label} · {option.value}</option>
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
  <div class="form-section__title">Характеристики</div>
  <div class="form-grid form-grid--four">
    <div class="field">
      <label for="card-cost">Стоимость</label>
      <input id="card-cost" type="number" step="any" value={numberValue("cost")} oninput={(event) => setNumber("cost", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-hp">HP</label>
      <input id="card-hp" type="number" step="any" value={numberValue("hp")} oninput={(event) => setNumber("hp", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-build">Время постройки</label>
      <input id="card-build" type="number" step="any" value={numberValue("buildTime")} oninput={(event) => setNumber("buildTime", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-shield">Щит</label>
      <input id="card-shield" type="number" step="any" value={numberValue("shield")} placeholder="—" oninput={(event) => setOptionalNumber("shield", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-dps">DPS</label>
      <input id="card-dps" type="number" step="any" value={numberValue("dps")} placeholder="—" oninput={(event) => setOptionalNumber("dps", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-speed">Скорость</label>
      <input id="card-speed" type="number" step="any" value={numberValue("speed")} placeholder="—" oninput={(event) => setOptionalNumber("speed", event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="card-range">Дальность</label>
      <input id="card-range" type="number" step="any" value={numberValue("range")} placeholder="—" oninput={(event) => setOptionalNumber("range", event.currentTarget.value)} />
    </div>
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
        <input type="checkbox" checked={item.new ?? false} onchange={(event) => (item.new = event.currentTarget.checked)} />
        <span>Новое — показать бейдж «Новое»</span>
      </label>
      <p class="field__hint" style="margin-top: 8px">
        <code>public/img/database</code>
      </p>
    </div>
  </div>
</div>
