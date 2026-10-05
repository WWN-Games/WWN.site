# Ассеты

Два корня: `src/assets/` — файлы, которые Astro обрабатывает на сборке (импортируются из кода и Markdown); `public/` — отдаётся как есть (копируется в `dist/` без изменений).

## src/assets

| Папка | Что внутри |
| --- | --- |
| `fonts/` | вариативные woff2-сабсеты latin/cyrillic: Geist, Geist Mono, Science Gothic, рядом лицензии `OFL-*.txt`. Подключаются через Fonts API в `astro.config.ts` (`cssVariable`: `--font-body`, `--font-mono`, `--font-display`), `<Font>` в `src/layouts/BaseLayout.astro` подключает их (display и body — с preload) |
| `img/lore/` | картинки статей вики (карты эпох, портреты, территории). Astro оптимизирует их в AVIF |
| `img/gallery/` | скриншоты галереи главной; список и подписи — `src/data/gallery.ts` |
| `img/bg/` | `banner-1440.avif` — фон первого экрана: `Hero.astro` импортирует его и через `<Image widths={[960, 1440]}>` получает оба размера. `banner-960.avif` — готовый узкий файл, в коде не используется |
| `img/factions/` | SVG-эмблемы фракций; `FactionCard` подключает их через `import.meta.glob`, имя файла указано в `factions.json` |

## public

| Путь | Что внутри |
| --- | --- |
| `img/brand/` | `logo.svg`, `favicon.svg`, `icon-192.png`, `icon-512.png` — бренд и иконки PWA |
| `img/bg/og-banner.webp` | превью для соцсетей (`og:image`, 1200×630). **Остаётся WebP** — скраперы не понимают AVIF |
| `img/database/` | иконки карточек `<id>.avif`, ширина не более 256 px (бокс карточки 256 px) |
| `audio/` | mp3: гимны фракций, пример речи; подключаются в статьях через `<audio src="../assets/audio/...">` |
| `robots.txt` | `Allow: /` и ссылка на `sitemap-index.xml` |
| `site.webmanifest` | PWA-манифест: имя, `start_url`, иконки из `img/brand/` |

## Правила замены

- Замена картинки — положить новый файл **с тем же именем** на место старого; ссылки менять не нужно.
- Переименование или смена формата — обновить все ссылки: путь в статье вики, `image`/`emblem` в `src/data/*.json`, `src` в `src/data/gallery.ts`.
- Новая иконка базы — `public/img/database/<id>.avif` (имя = `id` карточки), не шире 256 px.
- Картинки статей — только `src/assets/img/lore/`, скриншоты — только `src/assets/img/gallery/`; галерея и статьи не смешиваются.
- Все картинки контента — AVIF. Image service (`src/lib/image-service.ts`) по умолчанию переводит изображения Astro в AVIF, SVG не трогает. Исключения: `og-banner.webp` и PNG-иконки манифеста.
- Галерея: исходника шириной ~1600 px достаточно (лайтбокс показывает до 1240 px), варианты размеров (320–960) Astro делает сам.

## Пережатие

```bash
# AVIF без альфы
ffmpeg -i in.png -c:v libsvtav1 -crf 30 -preset 4 -pix_fmt yuv420p -svtav1-params tune=0 out.avif

# AVIF с альфой
avifenc -q 58 --qalpha 80 -s 6 in.png out.avif

# WebP — только для og-banner
ffmpeg -i in.png -c:v libwebp -quality 78 -compression_level 6 out.webp
```

## CSS и шрифты

- `src/styles/style.css` — общая дизайн-система, подключена в `BaseLayout`.
- `src/styles/wiki.css` — только страницы вики.
- `src/styles/database.css` — только страница базы данных.
- Трансформер — Lightning CSS (`vite.css.transformer: "lightningcss"` в `astro.config.ts`).
- Переменные `--font-display`, `--font-body`, `--font-mono` создаёт Fonts API: локальные woff2 с unicode-range latin/cyrillic, `display: swap`. Меняете набор или веса — правьте блок `fonts` в `astro.config.ts`; внешние Google Fonts не используются.

Локальный просмотр — `pnpm dev` (см. `docs/wiki.md`).
