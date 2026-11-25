# Импорт данных мода WWN

Скрипт читает исходники мода (`FER/`, `PE/`, `PLANETARY_TOOLS/`, `maps/`) и
обновляет JSON-коллекции сайта: `units.json`, `buildings.json`, `tags.json`,
`factions.json`, `maps.json`, а также превью карт в `public/img/maps/`.

## Запуск

```bash
# отчёт без записи
node scripts/import-mod/index.ts

# запись данных и превью карт
node scripts/import-mod/index.ts --write

# дополнительно вывести JSON новых карточек
node scripts/import-mod/index.ts --dump-new
```

Путь к исходникам по умолчанию — `/home/volren/Загрузки/WWN`. Другой путь:

```bash
WWN_MOD_DIR=/path/to/WWN node scripts/import-mod/index.ts --write
```

## Что делает импорт

- Разбирает `UDS*.template` и парный `Unit*.ini` с наследованием `copyFrom`,
  `@copyFromSection`, `@global` и `${...}`.
- Обновляет числовые статы, оружие, способности, заводы, транспорт и теги.
- Существующие названия, описания, картинки и ручные флаги сохраняются.
- Новые карточки получают `image: ""` — фотографии для них не добавляются.
- Карты получают превью `public/img/maps/<id>.avif` из `*_map.png`.
- Скрипт идемпотентен: повторный запуск не создаёт дублей.

## Ограничения

- `tur` не имеет уверенного источника в моде и остаётся без изменений.
- `taktring` сопоставлен с `PE/Units/TaktRing/TaktRingSP.ini` вручную.
- Значения `${...}`/`if ...`, которые не удалось разрешить, пропускаются;
  отчёт печатает неразрешённые ссылки.
