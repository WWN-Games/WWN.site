# Статьи вики

Статьи — Markdown-файлы в `src/content/wiki/{ru,en}/<раздел>/<статья>.md`. Astro Content Collections читают папку целиком: регистрировать статью больше нигде не нужно, URL, меню и поиск строятся на сборке.

## Путь и разделы

- RU: `src/content/wiki/ru/<раздел>/<статья>.md` — русский текст, источник истины.
- EN: `src/content/wiki/en/<раздел>/<статья>.md` — тот же slug, `order` и `draft`.
- Разделы описаны в `src/data/sections.json`: `id` = имя папки, `order` = порядок в меню, `icon` = иконка. Сейчас это `start`, `lore`, `factions`, `races`, `units`, `mechanics`, `guides`, `releases`, `misc`.
- URL статьи — `/wiki/<раздел>/<статья>/`, EN — `/en/wiki/<раздел>/<статья>/`. Slug — путь от папки языка, например `lore/history`.

## Front matter

```md
---
title: "Название статьи"
desc: "Одна строка для меню, поиска и описания страницы."
order: 3
updated: 2026-09-15
draft: false
---
```

| Поле | Тип | Правила |
| --- | --- | --- |
| `title` | строка | Заголовок статьи. **Всегда в двойных кавычках** |
| `desc` | строка | Короткое описание для меню, поиска и `<meta name="description">`. **Тоже всегда в двойных кавычках** |
| `order` | целое | Больше нуля, уникален внутри раздела; в RU и EN должен совпадать |
| `updated` | дата | Строго `ГГГГ-ММ-ДД`, реальная дата. Выводится в подписи статьи |
| `draft` | boolean | Необязательное, по умолчанию `false`. `true` — черновик: виден в `pnpm dev`, в прод-сборку не попадает |

- Если внутри `title`/`desc` нужна двойная кавычка — экранируйте её: `title: "Линкор \"Акула\""`.
- Незнакомое поле в шапке — ошибка валидации.
- `draft` надо ставить и снимать сразу в обеих языковых версиях: расхождение — ошибка.

## Проверка и сборка

```bash
pnpm validate   # паритет RU/EN, order, ссылки, картинки, схемы данных
pnpm build      # полная сборка, включая индекс поиска Pagefind
pnpm dev        # локальный просмотр; черновики видны
```

`pnpm validate` проверяет по статьям: раздел описан в `sections.json`; обязательные поля и их формат; совпадение `order` и `draft` в RU/EN; уникальность `order` внутри раздела; все `.md`-ссылки ведут в существующие статьи своего языка; все картинки и `../assets/...`-ассеты существуют. Любая ошибка — выход с кодом 1.

## Картинки

```md
![Карта галактики в эпоху Тройственного Конфликта](../../../../assets/img/lore/tc-ru.avif)
```

- Путь — относительный от файла статьи; для статьи вида `<раздел>/<статья>.md` это четыре `../` до `src/`, дальше `assets/img/...`.
- Картинки статей лежат в `src/assets/img/lore/`, эмблемы фракций — в `src/assets/img/factions/*.svg`, галерея главной — в `src/assets/img/gallery/`.
- Astro обрабатывает растровые картинки в AVIF (image service по умолчанию) и сам подставляет размеры — для картинок статей отдельные варианты `-960`/`-1440` не нужны (исключение — фон-hero хаба вики: там 960px-версия используется как 1x).
- Одиночная картинка абзацем становится фигурой с подписью из alt, несколько картинок в одном абзаце — галереей.

## Аудио

```html
<div class="audio-card"><span class="audio-card__label">Гимн Фенземской Республики</span><audio controls preload="metadata" src="../assets/audio/fenearth-anthem.mp3"></audio></div>
```

- Путь всегда начинается с `../assets/` (как будто статья лежит в `/wiki/`): rehype-плагин `rehypeAssetUrls` переписывает его в `/WWN.site/audio/...`.
- Файлы — в `public/audio/`; `pnpm validate` проверяет, что файл существует.

## Ссылки

- `[текст](history.md)` и `[текст](../factions/proton.md)` — remark-плагин `remarkWikiLinks` сам превращает их в `/WWN.site/wiki/<slug>/` (EN — `/en/wiki/...`), якорь `#...` сохраняется.
- Ссылки с протоколом (`https://…`), `#якорь` и абсолютные (`/…`) плагин не трогает.
- `.md`-ссылка на несуществующую статью валит `pnpm validate`.
- Заголовки `##`/`###` получают id автоматически (rehype-slug), на них можно ссылаться как `[текст](#имя-заголовка)`. В оглавление статьи попадают `h2`/`h3`, если их не меньше трёх.

## Оформление

- Обычный Markdown + GFM: таблицы, сноски `[^1]`, зачёркивание, чек-листы.
- Выноски: `<div class="callout">…</div>` и `<div class="callout callout--warn">…</div>`.
- Живой стенд со всеми элементами — статья `src/content/wiki/ru/misc/markup.md`.

## Пример полной статьи

`src/content/wiki/ru/guides/new-guide.md`:

```md
---
title: "Новый гайд"
desc: "Короткое описание для меню, поиска и выдачи."
order: 3
updated: 2026-10-05
draft: false
---

Вводный абзац со ссылкой на [обзор механик](../mechanics/overview.md) и внешним [источником](https://example.org).

## Карта

![Карта галактики в эпоху Тройственного Конфликта](../../../../assets/img/lore/tc-ru.avif)

<div class="callout">
<strong>Подсказка.</strong> Полезная информация по ходу текста.
</div>

## Аудио

<div class="audio-card"><span class="audio-card__label">Гимн Фенземской Республики</span><audio controls preload="metadata" src="../assets/audio/fenearth-anthem.mp3"></audio></div>

## Что дальше

- [Классы и роли юнитов](../units/roles.md)
```

Тот же файл обязателен в `src/content/wiki/en/guides/new-guide.md` — с тем же `order: 3`, `draft: false` и английскими `title`/`desc`.

## Терминология (RU → EN)

Единые варианты имён и терминов — используйте их во всех статьях и файлах `src/data/`:

| Русский | English |
| --- | --- |
| Фенземская Республика (ФЗР/Фензем) | Fenearth Republic (FR/Fenearth) |
| Движение Протон | Proton Movement |
| Единая Протонская Освободительная Армия | United Proton Liberation Army |
| Вастт, протонцы | Vasst, Protonians |
| Дегеры | Deguers |
| Всегалактическая Федерация (ВГФ) | Galactic Federation (GF) |
| Территория Отен | Oten Territory |
| Капо-Нантская / Капо-Бульская часть галактики | Capo-Nant / Capo-Bul sector of the galaxy |
| Минэль, минельцы | Minel, Minelians |
| Зиёнгоны | Ziyongons |
| Странники / Хранители | Wanderers / Keepers |
| Тройственный Конфликт | Triple Conflict |
| Война Очищения | War of Purification |
| Галактическая Смута | Galactic Turmoil |
| Период Затишья | Period of Calm |
| Период Гийи | Period of Gii |
| Далекое Прошлое | Distant Past |
| Территория Черного Рынка | Black Market Territory |
| Инкорпорация Независимых Регионов | Incorporation of Independent Regions |

Аббревиатуры без расшифровки пишутся в EN так же, как в игре: СИП → TIC, КЗС → DSC, МПВО → MAD, Дальнострел → Eye of Reach, СЛУК → SLSS.
