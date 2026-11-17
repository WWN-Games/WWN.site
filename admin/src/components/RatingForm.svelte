<script lang="ts">
  import type { RatingEntry } from "../../shared/types";

  interface Props {
    item: RatingEntry;
  }

  const { item = $bindable() }: Props = $props();
</script>

<div class="form-section">
  <div class="form-section__title">Рейтинг</div>
  <div class="form-grid form-grid--three">
    <div class="field">
      <label for="rating-id">ID</label>
      <input id="rating-id" value={item.id} spellcheck="false" placeholder="player-1" oninput={(event) => (item.id = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="rating-nickname">Ник</label>
      <input id="rating-nickname" value={item.nickname} placeholder="Nickname" oninput={(event) => (item.nickname = event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="rating-value">Рейтинг</label>
      <input id="rating-value" type="number" step="any" value={item.rating} oninput={(event) => (item.rating = Number(event.currentTarget.value) || 0)} />
    </div>
  </div>
  <p class="field__hint">На сайте записи автоматически сортируются по рейтингу по убыванию.</p>
</div>
