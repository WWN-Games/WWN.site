/* ============================================================================
   WWN — данные главной (ES-модуль)
   ----------------------------------------------------------------------------
   Новости, галерея, теги и резервные цифры статистики. Подключается динамически
   вместе с блоками главной, чтобы не утяжелять критический путь страниц.
   ============================================================================ */

export const SITE_DATA = {
  // ---------------------------------------------------------------------------
  // NUMBERS — резерв для блока статистики главной. Живые значения лежат
  // в data/stats.json и подхватываются assets/js/home/stats.js.
  // Обновляя units.json / buildings.json / factions.json, поправьте stats.json
  // и эти значения. Карт в данных сайта нет — указываются тут.
  // ---------------------------------------------------------------------------
  stats: {
    units: 180,
    factions: 2,
    maps: 13
  },

  // ---------------------------------------------------------------------------
  // NEWS TAGS — доступные теги для news[].tag: id + подпись на двух языках.
  // Цвет задаётся классом .tag--<id> в assets/css/style.css
  // (для update отдельного класса нет — используется базовый .tag).
  // ---------------------------------------------------------------------------
  newsTags: {
    update: { ru: "Обновление", en: "Update" },
    news: { ru: "Новости", en: "News" },
  },

  // ---------------------------------------------------------------------------
  // NEWS — карточки в разделе «Что нового»: добавляйте/убирайте свободно.
  // ---------------------------------------------------------------------------
  news: [
    {
      date: "2026-09-15",
      tag: "news",
      ru: {
        title: "Лор WWN теперь на сайте",
        text: "Полная история галактики: Странники и Хранители, Война Очищения, Смута и Тройственный Конфликт — с картами эпох."
      },
      en: {
        title: "WWN lore is now on the site",
        text: "The full galaxy history: Wanderers and Keepers, the War of Purification, the Turmoil and the Triple Conflict — with era maps."
      }
    },
    {
      date: "2026-08-20",
      tag: "news",
      ru: {
        title: "Мод в Steam Workshop",
        text: "Подпишись на WWN в мастерской Steam — обновления будут приходить автоматически."
      },
      en: {
        title: "The mod is on Steam Workshop",
        text: "Subscribe to WWN on Steam Workshop — updates arrive automatically."
      }
    },
    {
      date: "2026-08-16",
      tag: "news",
      ru: {
        title: "Вселенной WWN исполняется 10 лет 🏆",
        text: "С юбилеем, WWN!"
      },
      en: {
        title: "The WWN universe is turning 10 years old 🏆",
        text: "Happy Anniversary, WWN!"
      }
    }
  ],

  // ---------------------------------------------------------------------------
  // GALLERY — картинки из assets/img/gallery; caption локализуется.
  // Необязательные ключи: wide (2 колонки), tall (2 строки), srcEn (картинка только для EN).
  // ---------------------------------------------------------------------------
  gallery: [
    {
      src: "assets/img/gallery/screenshot-1.avif",
      wide: true,
      ru: { caption: "Ядерный удар" },
      en: { caption: "Nuclear strike" }
    },
    {
      src: "assets/img/gallery/screenshot-2.avif",
      ru: { caption: "Фензем юниты" },
      en: { caption: "Fenearth units" }
    },
    {
      src: "assets/img/gallery/screenshot-3.avif",
      ru: { caption: "Протон юниты" },
      en: { caption: "Proton units" }
    }
  ]
};
