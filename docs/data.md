# Данные базы

Данные лежат в `src/data/`, читаются Astro Content Collections (`src/content.config.ts`) и валидируются Zod-схемами из `src/lib/schemas.ts`. Схемы — источник правды: те же проверки гоняет `pnpm validate`, плюс ссылки, картинки и уникальность id.

## Файлы

| Файл | Коллекция | Что внутри |
| --- | --- | --- |
| `units.json` | `units` | юниты |
| `buildings.json` | `buildings` | строения |
| `factions.json` | `factions` | фракции |
| `tags.json` | `tags` | реестр тегов |
| `sections.json` | `sections` | разделы вики |
| `stats.json` | — (импорт) | только `{ "maps": N }` |
| `news.ts`, `gallery.ts` | — | новости и галерея главной (TypeScript) |

- В JSON допустимы ключи-комментарии `_schema`/`_comment`: загрузчик читает только массив (`units`, `buildings`, `factions`, `tags`, `sections`).
- Все подписи — `{ "ru": "...", "en": "..." }`. Если `en` не писать, он станет равен `ru` (нормализация на границе данных). **Русский — источник истины.**

## Карточки: units.json и buildings.json

Массивы `units` и `buildings`; набор полей одинаковый, отличается только `type`.

```json
{
  "id": "ahaosa",
  "name": { "ru": "Лодка ПВО", "en": "AA Boat" },
  "faction": "proton",
  "type": "naval",
  "desc": { "ru": "…", "en": "…" },
  "tags": ["T1", "ship", "HOVER"],
  "cost": 100, "hp": 320, "shield": 40, "selfRegen": 2, "shieldRegen": 5,
  "weapons": [
    { "name": { "ru": "Главный калибр", "en": "Main gun" }, "damage": 80 },
    { "name": { "ru": "Зенитка", "en": "AA gun" }, "damage": 40 }
  ],
  "speed": 0.9, "range": 245, "buildTime": 6
}
```

| Поле | Обяз. | Правила |
| --- | --- | --- |
| `id` | да | Уникален; общий namespace у юнитов и строений |
| `name`, `desc` | да | `{ ru, en }` |
| `faction` | да | `id` из `factions.json` |
| `type` | да | units: `ground` / `air` / `naval` / `space` / `support`; buildings: `economy` / `defense` / `structure` |
| `tags` | да | Массив `id` из `tags.json` (может быть пустым) |
| `cost`, `hp`, `buildTime` | да | Числа |
| `shield`, `selfRegen`, `shieldRegen`, `dps`, `speed`, `range` | нет | Числа; можно не писать, если 0 |
| `weapons` | нет | Массив орудий: `{ name: { ru, en }, damage }`. Если массив непустой, `dps` считается как сумма `damage` всех орудий и в JSON карточки показывается это значение. |
| `image` | нет | Путь относительно `public/`; `""` — вместо картинки инициалы |
| `role` | нет | `{ ru, en }` — роль, выводится чипом |
| `strongVs`, `weakVs` | нет | Массив строк или `{ ru, en }` |
| `draft` | нет | `true` — бейдж «Черновик» |
| `new` | нет | `true` — бейдж «Новое» |

- Картинка по умолчанию — `public/img/database/<id>.avif`. Поле `image` переопределяет путь (например `img/database/custom.avif`), `"image": ""` отключает картинку и показывает инициалы. Валидация проверяет существование файла (кроме `""`).
- Полосы характеристик (прочность, щит, самореген, реген щита, урон, скорость, дальность) считаются на сборке по общей шкале всех карточек (`src/lib/database.ts`) — максимумы вручную не задаются.
- В сравнении карточек орудия выводятся отдельными строками «Орудие 1», «Орудие 2» и т.д. с названием и уроном.

## Фракции: factions.json

```json
{
  "id": "fenearth",
  "order": 1,
  "name": { "ru": "Фенземская Республика", "en": "Fenearth Republic" },
  "color": "#3b9bff",
  "emblem": "assets/img/factions/faction-fer.svg",
  "lore": "factions/fenearth",
  "desc": { "ru": "…", "en": "…" }
}
```

| Поле | Обяз. | Правила |
| --- | --- | --- |
| `id`, `name`, `desc` | да | Как у карточек |
| `order` | да | Порядок в базе и фильтрах: 1 — Фенземская Республика, 2 — Движение Протон, дальше остальные |
| `color` | да | `#rrggbb` |
| `emblem` | да | Путь к SVG; используется имя файла из `src/assets/img/factions/` |
| `lore` | да | Slug статьи вики (`<раздел>/<статья>`); ссылка появится, только если статья опубликована |
| `motto`, `playstyle`, `specialty` | нет | `{ ru, en }` |
| `strengths`, `weaknesses` | нет | `{ "ru": [...], "en": [...] }` |
| `subfaction` | нет | `true` — плашка «Подфракция»; строка — `id` родительской фракции, её имя попадёт в плашку |

## Теги: tags.json

Поля: `id`, `name` `{ ru, en }`, `group` — `tier` | `class` | `movement` | `mod`. Сначала добавьте запись сюда, потом впишите `id` в `tags` карточки. Незарегистрированный тег покажется как есть, но `pnpm validate` на нём упадёт.

## Разделы вики: sections.json

`id` = папка в `src/content/wiki/<язык>/` и якорь `#wiki-cat-<id>` на хабе; `icon` — одна из `book | shield | cube | gear | compass | users | clock | rocket | chat`; `order` уникален; `title`, `desc` — `{ ru, en }`. Статьи внутри раздела не перечисляются: они берутся из front matter самих статей (см. `docs/content.md`).

## Цифры: stats.json

```json
{ "maps": 13 }
```

Единственное поле — число карт. Остальное считается на сборке: `units`, `buildings`, `cards` (= units + buildings), `factions`, `tags` — `collectStats()` в `src/lib/stats.ts`, `getStats()` в `src/lib/wiki.ts` и эндпоинт `stats.json`.

## Публичный API

Сборка публикует статические JSON-эндпоинты: `/api/v1/units.json`, `buildings.json`, `factions.json`, `tags.json`, `stats.json`, `index.json` (манифест).

Общий конверт: `{ schemaVersion, generatedAt, count, items }`, `schemaVersion: 1`. Ответ формируется с заголовком `Cache-Control: public, max-age=3600`, но GitHub Pages отдаёт статические файлы без кастомных заголовков — фактический кэш зависит от хостинга/CDN. В `items` — данные коллекции, отсортированные по `id` (исключение — `factions.json`: по `order`, затем по `id`); в `stats.json` элементы `{ id, value }`, в `index.json` — `{ id, url, count }`.

## Сравнение карточек

На странице базы можно выбрать до четырёх юнитов или строений и открыть сравнение. Выбор хранится раздельно для вкладок, в `localStorage` и в URL:

```text
/database/?compare=units:ahaosa,akula#units
```

Формат: `<units|buildings>:<id>,<id>,<id>,<id>`. Ссылка открывает нужную вкладку, восстанавливает выбор и сразу показывает диалог сравнения. Неизвестные id и карточки другой вкладки отбрасываются. Максимум — `MAX_COMPARE` в `src/lib/compare.ts`; чистая логика метрик и URL покрыта `tests/unit/database-view.test.ts`.


## Валидация

```bash
pnpm validate
```

Проверяет Zod-схемы всех файлов; уникальность `id` (в том числе между `units.json` и `buildings.json`); ссылки `faction` и `tags` на существующие записи; существование картинок карточек; схему `stats.json`. Плюс проверки вики — см. `docs/content.md`.
