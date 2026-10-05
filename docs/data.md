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
  "cost": 100, "hp": 320, "dps": 120, "speed": 0.9, "range": 245, "buildTime": 6
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
| `shield`, `dps`, `speed`, `range` | нет | Числа; можно не писать, если 0 |
| `image` | нет | Путь относительно `public/`; `""` — вместо картинки инициалы |
| `role` | нет | `{ ru, en }` — роль, выводится чипом |
| `strongVs`, `weakVs` | нет | Массив строк или `{ ru, en }` |
| `draft` | нет | `true` — бейдж «Черновик» |
| `new` | нет | `true` — бейдж «Новое» |

- Картинка по умолчанию — `public/img/database/<id>.avif`. Поле `image` переопределяет путь (например `img/database/custom.avif`), `"image": ""` отключает картинку и показывает инициалы. Валидация проверяет существование файла (кроме `""`).
- Полосы характеристик (прочность, щит, урон, скорость, дальность) считаются на сборке по общей шкале всех карточек (`src/lib/database.ts`) — максимумы вручную не задаются.

## Фракции: factions.json

```json
{
  "id": "fenearth",
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

Единственное поле — число карт. Остальное считается на сборке: юниты + строения, фракции, теги, `cards` (= units + buildings) — `getStats()` в `src/lib/wiki.ts` и эндпоинт `stats.json`.

## Публичный API

Сборка публикует статические JSON-эндпоинты: `/api/v1/units.json`, `buildings.json`, `factions.json`, `tags.json`, `stats.json`, `index.json` (манифест).

Общий конверт: `{ schemaVersion, generatedAt, count, items }`, `schemaVersion: 1`, заголовок `Cache-Control: public, max-age=3600`. В `items` — данные коллекции, отсортированные по `id`; в `stats.json` элементы `{ id, value }`, в `index.json` — `{ id, url, count }`.

## Валидация

```bash
pnpm validate
```

Проверяет Zod-схемы всех файлов; уникальность `id` (в том числе между `units.json` и `buildings.json`); ссылки `faction` и `tags` на существующие записи; существование картинок карточек; схему `stats.json`. Плюс проверки вики — см. `docs/content.md`.
