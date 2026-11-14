# Данные базы

Данные лежат в `src/data/`, читаются Astro Content Collections (`src/content.config.ts`) и валидируются Zod-схемами из `src/lib/schemas.ts`. Схемы — источник правды: те же проверки гоняет `pnpm validate`, плюс ссылки, картинки и уникальность id.

## Файлы

| Файл | Коллекция | Что внутри |
| --- | --- | --- |
| `units.json` | `units` | юниты |
| `buildings.json` | `buildings` | строения |
| `misc.json` | `misc` | вооружение и технологии (вкладка «Разное») |
| `factions.json` | `factions` | фракции |
| `tags.json` | `tags` | реестр тегов |
| `sections.json` | `sections` | разделы вики |
| `maps.json` | `maps` | каталог карт |
| `gallery.json` | `gallery` | скриншоты |
| `videos.json` | `videos` | видео с YouTube |
| `feats.json` | `feats` | подвиги |
| `stats.json` | — (импорт) | резервное число карт, пока каталог пуст |
| `news.ts` | — | новости главной (TypeScript) |

- В JSON допустимы ключи-комментарии `_schema`/`_comment`: загрузчик читает только массив (`units`, `buildings`, `factions`, `tags`, `sections`).
- Все подписи — `{ "ru": "...", "en": "..." }`. Если `en` не писать, он станет равен `ru` (нормализация на границе данных). **Русский — источник истины.**

## Карточки: units.json, buildings.json и misc.json

Массивы `units`, `buildings` и `misc`; набор полей одинаковый, тип карточки больше не хранится — классификация задаётся тегами. «Разное» использует ту же карточку, поиск, фильтры и сравнение.

```json
{
  "id": "ahaosa",
  "name": { "ru": "Лодка ПВО", "en": "AA Boat" },
  "faction": "proton",
  "desc": { "ru": "…", "en": "…" },
  "tags": ["T1", "ship", "HOVER"],
  "cost": 100,
  "energy": 40,
  "hp": 320,
  "shield": 40,
  "armor": 5,
  "selfRegen": 2,
  "shieldRegen": 5,
  "speed": 0.9,
  "turnSpeed": 60,
  "range": 245,
  "buildTime": 6,
  "weapons": [
    {
      "name": { "ru": "Главный калибр", "en": "Main gun" },
      "count": 2,
      "projectileCount": 2,
      "projectileDelay": 0.15,
      "damage": 80,
      "fireDelay": 1.5,
      "armourIgnoreAmount": 10,
      "tags": ["long", "splash", "front", "right"],
      "spread": 12,
      "splashRadius": 30
    }
  ],
  "builder": {
    "buildRange": 300,
    "repairSpeed": 15,
    "buildSpeed": 10,
    "healTags": ["tank", "bot"]
  },
  "factories": [
    { "name": { "ru": "Аэродром", "en": "Aerodrome" }, "buildSpeed": 1.23, "producedUnits": ["ahaosa"] }
  ],
  "transports": [
    { "name": { "ru": "Трюм", "en": "Hold" }, "seats": 4, "cargoTags": ["tank"], "unload": ["shore", "water"] }
  ]
}
```

| Поле | Обяз. | Правила |
| --- | --- | --- |
| `id` | да | Уникален; общий namespace у юнитов и строений |
| `name`, `desc` | да | `{ ru, en }` |
| `faction` | да | `id` из `factions.json` |
| `tags` | да | Массив `id` обычных тегов из `tags.json` |
| `cost`, `energy`, `hp`, `buildTime` | да | Числа; `energy` обязательна даже при 0 |
| `shield`, `armor`, `selfRegen`, `shieldRegen`, `speed`, `turnSpeed`, `range` | нет | Числа, допустимы дробные; можно не писать, если 0 |
| `weapons` | нет | Массив орудий (см. ниже) |
| `missileDefense`, `torpedoDefense` | нет | `{ max, recharge }`: заряды и восстановление зарядов/с |
| `laserDefense` | нет | `true` — лазерная защита |
| `domeShield` | нет | `{ radius, points, regen }` |
| `atmosphere` | нет | `{ time }` — время входа в атмосферу, с |
| `ftlJump` | нет | `{ type: "siv" \\| "plasma", chargeTime, cooldown, minDistance, energyCost? }` |
| `builder` | нет | `{ buildRange, repairSpeed, buildSpeed, healTags }` |
| `factories` | нет | Массив заводов `{ name, buildSpeed, producedUnits }` |
| `transports` | нет | Массив отделений `{ name, seats, cargoTags, unload }` |
| `image` | нет | Путь относительно `public/`; `""` — вместо картинки инициалы |
| `role` | нет | `{ ru, en }` — роль, выводится чипом |
| `strongVs`, `weakVs` | нет | Массив строк или `{ ru, en }` |
| `draft` | нет | `true` — бейдж «Черновик» |
| `new` | нет | `true` — золотая плашка «Новинка!» |
| `newUntil` | нет | Дата `YYYY-MM-DD`; после неё плашка скрывается (в том числе на клиенте) |

- Полная стоимость: `cost + energy / 4`. В списке карточек показывается только она.
- DPS карточки: сумма `count * projectileCount * damage / fireDelay` по всем орудиям. Без оружия DPS = 0.
- `buildTime` — секунды при скорости 1; в интерфейсе подписывается `с (×1)`.
- Обычные теги карточки берутся из групп `tier | class | movement | mod`.
- Картинка по умолчанию — `public/img/database/<id>.avif`. Поле `image` переопределяет путь, `"image": ""` отключает картинку.
- Полосы характеристик (прочность, щит, броня, реген, реген щита, DPS, скорость, дальность) считаются на сборке по общей шкале всех карточек (`src/lib/database.ts`).

### Оружие

Поля орудия:

| Поле | Обяз. | Правила |
| --- | --- | --- |
| `name` | да | `{ ru, en }` |
| `count` | нет | Количество одинаковых орудий, по умолчанию 1; учитывается в DPS |
| `projectileCount` | нет | Снарядов за выстрел, по умолчанию 1; учитывается в DPS |
| `projectileDelay` | нет | Пауза между снарядами залпа, с; в DPS не входит |
| `damage` | да | Урон одного снаряда |
| `fireDelay` | да | Задержка между выстрелами в секундах, больше нуля |
| `armourIgnoreAmount` | нет | Бронебойность снаряда |
| `tags` | нет | Теги из групп `weapon` и `sector` |
| `spread` | нет | Разброс; показывается при теге `splash` |
| `splashRadius` | нет | Радиус сплеша; показывается при теге `splash` |
| `stunDuration` | нет | Длительность стана в секундах; показывается при теге `stun` |

Теги оружия: `close`, `long`, `anti-air`, `anti-orbital`, `anti-sub`, `splash`, `stun`, `laser`, `plasma`, `blaster`, `rocket`, `space-only`, `surface-only`. Секторы: `front`, `left`, `right`, `rear`.

### Строитель, заводы и транспорт

- `builder` доступен и юнитам, и строениям; `healTags` — обычные теги карточек.
- `factories` — несколько записей; каждая производит только юнитов (`producedUnits` — id из `units.json`).
- `transports` — несколько отделений; `cargoTags` — обычные теги, `unload` — фиксированные значения `shore | water | air | underwater | space`.
- Картинок у заводов и транспортных отделений пока нет.

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

Поля: `id`, `name` `{ ru, en }`, `group` — `tier` | `class` | `movement` | `mod` | `weapon` | `sector`. Сначала добавьте запись сюда, потом впишите `id` в `tags` карточки или оружия. Незарегистрированный тег покажется как есть, но `pnpm validate` на нём упадёт.

## Разделы вики: sections.json

`id` = папка в `src/content/wiki/<язык>/` и якорь `#wiki-cat-<id>` на хабе; `icon` — одна из `book | shield | cube | gear | compass | users | clock | rocket | chat`; `order` уникален; `title`, `desc` — `{ ru, en }`. Статьи внутри раздела не перечисляются: они берутся из front matter самих статей (см. `docs/content.md`).

## Карты, галерея, видео, подвиги

- `maps.json` — `id`, `name`, `desc`, `image` (по умолчанию `img/maps/<id>.avif`), `players`, `size`, `mode`, `author`, `download`, `order`, `new`, `newUntil`.
- `gallery.json` — `id`, `order`, `image` (путь относительно `src/`, например `assets/img/gallery/screenshot-1.avif`), `caption`, `wide`.
- `videos.json` — `id`, `order`, `youtubeId`, `lang` (`ru` / `en`), `title`, `desc`, `date`.
- `feats.json` — `id`, `order`, `name`, `desc`, `image` (по умолчанию `img/feats/<id>.avif`), `date`, `new`, `newUntil`.

Все четыре коллекции редактируются в локальной админке; картинки загружаются через форму.

## Цифры: stats.json

```json
{ "maps": 13 }
```

Число карт берётся из коллекции `maps`; пока каталог пуст, используется значение из `stats.json`. Остальное считается на сборке: `units`, `buildings`, `misc`, `cards` (= units + buildings + misc), `factions`, `tags` — `collectStats()` в `src/lib/stats.ts`, `getStats()` в `src/lib/wiki.ts` и эндпоинт `stats.json`.

## Публичный API

Сборка публикует статические JSON-эндпоинты: `/api/v1/units.json`, `buildings.json`, `misc.json`, `maps.json`, `factions.json`, `tags.json`, `stats.json`, `index.json` (манифест).

Общий конверт: `{ schemaVersion, generatedAt, count, items }`, `schemaVersion: 2`. Ответ формируется с заголовком `Cache-Control: public, max-age=3600`, но GitHub Pages отдаёт статические файлы без кастомных заголовков — фактический кэш зависит от хостинга/CDN. В `items` — данные коллекции, отсортированные по `id` (исключение — `factions.json`: по `order`, затем по `id`); в `stats.json` элементы `{ id, value }`, в `index.json` — `{ id, url, count }`.

## Сравнение карточек

На странице базы можно выбрать до четырёх юнитов или строений и открыть сравнение. Выбор хранится раздельно для вкладок, в `localStorage` и в URL:

```text
/database/?compare=units:ahaosa,akula#units
```

Формат: `<units|buildings|misc>:<id>,<id>,<id>,<id>`. Ссылка открывает нужную вкладку, восстанавливает выбор и сразу показывает диалог сравнения. Неизвестные id и карточки другой вкладки отбрасываются. Максимум — `MAX_COMPARE` в `src/lib/compare.ts`; чистая логика метрик и URL покрыта `tests/unit/database-view.test.ts`.

Полная карточка открывается в модальном окне и хранится в URL отдельно:

```text
/database/?card=units:ahaosa#units
```

В сравнении есть фильтр оружия по тегам (режимы И / ИЛИ). DPS по выбранным тегам считается только по подходящим орудиям, а эффективность — всегда по общему DPS на 100 полной стоимости.


## Валидация

```bash
pnpm validate
```

Проверяет Zod-схемы всех файлов; уникальность `id` (в том числе между `units.json`, `buildings.json` и `misc.json`); ссылки `faction` и `tags` на существующие записи; теги оружия из групп `weapon`/`sector`; ссылки заводов на существующих юнитов; обычные теги строителя и транспорта; существование картинок карточек, карт, подвигов и галереи; схему `stats.json`. Плюс проверки вики — см. `docs/content.md`.
