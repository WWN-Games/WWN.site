# WWN — сайт мода для Rusted Warfare

Статический сайт: Astro 7 + TypeScript 7, острова на Svelte 5, поиск на Pagefind,
контент и данные — Content Collections с Zod-валидацией.
Деплой — GitHub Pages (base `/WWN.site`), сборка артефакта через GitHub Actions.

## Требования

- Node.js 26 (`.nvmrc`), pnpm 12 (corepack: `corepack enable`)
- `pnpm install`

## Технологии

- **TypeScript 7.1** — нативный `tsc` (beta), `.astro` проверяет content mapper
- **Astro 7** — статическая сборка с Content Layer
- **Svelte 5** — острова интерактивности (runes)
- **Pagefind** — клиентский поиск по индексу
- **Biome** — линтер и форматтер
- **Vitest + Playwright** — unit и e2e-тесты

## Команды

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | dev-сервер Astro |
| `pnpm build` | сборка в `dist/` (включая индекс Pagefind) |
| `pnpm preview` | локальный предпросмотр сборки |
| `pnpm check` | `tsc` (TypeScript 7) + content mapper: типы .astro/.ts |
| `pnpm lint` / `pnpm lint:fix` | Biome: линт и формат |
| `pnpm validate` | валидация контента и данных (паритет RU/EN, ссылки, схемы) |
| `pnpm test` | unit-тесты (Vitest) |
| `pnpm test:e2e` | сборка + e2e/a11y-тесты (Playwright) |
| `pnpm admin` | локальная админка (см. ниже) |

## Админка

Локальный редактор контента и git-операций: `pnpm admin` →
<http://127.0.0.1:4322>. Админка входит в общий pnpm-workspace и использует
корневой `pnpm install` и общий lockfile.

- `ADMIN_HOST` (по умолчанию `127.0.0.1`), `ADMIN_PORT` (4322), `SITE_ORIGIN`
  (адрес dev-сервера сайта).
- При запуске не на loopback задайте `ADMIN_ORIGIN` — иначе запросы с других
  origin будут отклонены.
- Аутентификации нет: не выставляйте админку в публичную сеть.
- Проверка типов админки: `pnpm --dir admin check` (тот же TypeScript 7, что и у сайта).
- Сборка админки: `pnpm --dir admin build`.

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
admin/              — локальная админка (Vite + Svelte, часть workspace)
public/             — robots, manifest, иконки базы, аудио, брендинг
scripts/            — validate-content.ts, typecheck.ts, preview.mjs (для e2e)
tests/              — unit (Vitest) и e2e (Playwright)
docs/               — документация для редакторов контента
```

## Языки

- RU — корень сайта, EN — префикс `/en/`. Переключатель — ссылки, выбор хранится
  в `localStorage`. Никаких `?lang=`.

## База данных

Страница `/database/` строит карточки статически, а Svelte-остров управляет
поиском, фильтрами, сортировкой и сравнением. Фильтр тегов работает в режимах
«И» (все выбранные теги) и «ИЛИ» (любой из выбранных). Выбранные карточки
хранятся в `localStorage` и URL: `?compare=units:ahaosa,akula#units` (до четырёх,
раздельно для юнитов и строений). Логика сравнения — `src/lib/compare.ts`,
фильтрации — `src/lib/database-view.ts`.

## Публичный API данных

Сборка публикует статические JSON-эндпоинты: `/api/v1/units.json`,
`/buildings.json`, `/factions.json`, `/tags.json`, `/stats.json`,
`/index.json` (манифест со `schemaVersion`).
