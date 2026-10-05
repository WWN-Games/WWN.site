# Архитектура вики

Вики целиком строится на сборке из Content Collections: отдельных сгенерированных HTML/JSON в репозитории нет, синхронизировать вручную ничего не нужно.

## Маршруты

| Страница | Файл-роут | URL |
| --- | --- | --- |
| Хаб RU | `src/pages/wiki/index.astro` | `/wiki/` |
| Статья RU | `src/pages/wiki/[...slug].astro` | `/wiki/<раздел>/<статья>/` |
| Хаб EN | `src/pages/en/wiki/index.astro` | `/en/wiki/` |
| Статья EN | `src/pages/en/wiki/[...slug].astro` | `/en/wiki/<раздел>/<статья>/` |

`getStaticPaths()` берёт статьи из коллекции (`getEntries(lang)`), поэтому каждая статья — статическая страница. RU живёт в корне, EN — с префиксом `/en/` (i18n в `astro.config.ts`), base сайта — `/WWN.site`.

## Навигация и блоки — из коллекций

Всё считает `src/lib/wiki.ts` на сборке:

| Функция | Что даёт |
| --- | --- |
| `getEntries` / `getPublished` | статьи языка (в dev — с черновиками), порядок: раздел → `order` → title |
| `getNav` | разделы с опубликованными статьями — сайдбар и хаб |
| `getSections` | разделы из `sections.json` по `order` |
| `getRelated` | «Читать также»: исходящие и входящие `.md`-ссылки + соседи по разделу, максимум 4 |
| `getPager` | предыдущая/следующая статья в общем порядке |
| `getStats` | юниты + строения и фракции (по коллекциям), карты (из `stats.json`) |

Компоненты — в `src/components/wiki/`: `WikiSidebar`, `WikiHub`, `Related`, `Pager`, `Toc`, `Breadcrumbs`, `ArticleMeta`. Оглавление строится из `headings` рендера (`h2`/`h3`, если их не меньше трёх). Меню, related и пейджер руками не правятся.

## Черновики

`includeDrafts = import.meta.env.DEV` (`src/lib/wiki.ts`): `draft: true` виден в `pnpm dev`, но `pnpm build` его не собирает — страницы нет, в сайдбаре, хабе, related, пейджере и поиске он не появляется. Чтобы опубликовать — `draft: false` или удалить строку в обеих языковых версиях.

## Поиск

- Pagefind (`astro-pagefind` в `astro.config.ts`) индексирует HTML на `pnpm build` и кладёт бандл в `dist/pagefind/`.
- Индексируются только статьи: у `<article>` стоит `data-pagefind-body`, раздел — фильтр `data-pagefind-filter="section:<id>"`, заголовок — `data-pagefind-meta="title"`. Служебные блоки помечены `data-pagefind-ignore`.
- UI — `src/components/search/WikiSearch.svelte` (в сайдбаре, Ctrl/Cmd+K): поиск, фильтры по разделам, недавние запросы. Загрузка бандла и хелперы URL — в `src/lib/search.ts`.
- В `pnpm dev` сервер отдаёт `/pagefind/` из `dist/`: если `pnpm build` ещё не запускался, поиск не заработает — соберите сайт или смотрите через `pnpm preview`.

## Локально

```bash
pnpm dev      # dev-сервер Astro, base /WWN.site (порт по умолчанию 4321)
pnpm build    # dist/ + индекс Pagefind
pnpm preview  # предпросмотр собранного сайта
```

- Статьи — `docs/content.md`, данные базы — `docs/data.md`, ассеты — `docs/assets.md`.
- В каждой статье есть ссылки «Редактировать» и «Сообщить» на GitHub: файл статьи — `src/content/wiki/<язык>/<slug>.md`.
