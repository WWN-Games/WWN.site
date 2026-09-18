# Страницы вики

`wiki/index.html` — хаб вики: единственная ручная страница здесь. Разделы и
карточки строятся из `data/wiki-nav.json`.

Папки `wiki/<раздел>/<статья>/` **генерируются** скриптом
`node tools/build-wiki.mjs` из контента `content/` — руками их не правят.

| Что | Где |
| --- | --- |
| хаб вики | `wiki/index.html` (адрес `/wiki/`) |
| страницы статей | `wiki/<раздел>/<статья>/index.html`, адрес вида `/wiki/lore/overview/` |
| шаблон статьи | `tools/templates/article.html` — правки оболочки статьи здесь |
| сборка | `node tools/build-wiki.mjs`, проверка — `node tools/build-wiki.mjs --check` |

Сборка заодно пишет `data/wiki-nav.json`, `data/search-index-<язык>.json`,
`data/wiki-related.json`, `data/wiki-links.json` и `sitemap.xml`.

База данных — `database/index.html`, адрес `/database/`.

- Новая статья — Markdown-файл в `content/ru/` и `content/en/` с `title`,
  `desc` и `order` в шапке: см. `../content/README.md`.
- Фракции, юниты и строения базы данных — в `data/`: см. `../data/README.md`.
- Картинки, аудио, тексты интерфейса и ссылки — в `assets/`: см. `../assets/README.md`.

Локальный предпросмотр — через сервер: `python3 -m http.server 8000`
и <http://localhost:8000>.
