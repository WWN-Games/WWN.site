# WWN — сайт мода для Rusted Warfare

Статический сайт: Astro 7 + TypeScript, острова на Svelte 5, поиск на Pagefind,
контент и данные — Content Collections с Zod-валидацией.
Деплой — GitHub Pages (base `/WWN.site`), сборка артефакта через GitHub Actions.

## Требования

- Node.js 26 (`.nvmrc`), pnpm 12 (corepack: `corepack enable`)
- `pnpm install`

## Команды

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | dev-сервер Astro |
| `pnpm build` | сборка в `dist/` (включая индекс Pagefind) |
| `pnpm preview` | локальный предпросмотр сборки |
| `pnpm check` | `astro check`: типы .astro/.ts + контент |
| `pnpm lint` / `pnpm lint:fix` | Biome: линт и формат |
| `pnpm validate` | валидация контента и данных (паритет RU/EN, ссылки, схемы) |
| `pnpm test` | unit-тесты (Vitest) |
| `pnpm test:e2e` | e2e/a11y-тесты (Playwright) |

## Структура

```
src/
├─ content/wiki/{ru,en}/<раздел>/<статья>.md  — статьи вики
├─ data/            — units, buildings, factions, tags, sections, stats, news, gallery
├─ i18n/            — словари RU/EN (паритет гарантируется типами)
├─ lib/             — схемы, доступ к контенту, markdown-плагины, утилиты
├─ components/      — layout, home, wiki, database, search
├─ layouts/         — BaseLayout
├─ pages/           — маршруты (RU в корне, EN под /en/)
├─ scripts/         — клиентские скрипты (шапка, TOC, hero и т.п.)
└─ styles/          — глобальный CSS
public/             — robots, manifest, иконки базы, аудио, брендинг
```

## Языки

- RU — корень сайта, EN — префикс `/en/`. Переключатель — ссылки, выбор хранится
  в `localStorage`. Никаких `?lang=`.

## Публичный API данных

Сборка публикует статические JSON-эндпоинты: `/api/v1/units.json`,
`/buildings.json`, `/factions.json`, `/tags.json`, `/stats.json`,
`/index.json` (манифест со `schemaVersion`).
