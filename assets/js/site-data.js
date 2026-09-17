/* ============================================================================
   WWN — данные главной (ES-модуль)
   ----------------------------------------------------------------------------
   Новости, галерея и теги. Подключается динамически вместе с блоками главной,
   чтобы не утяжелять критический путь страниц.
   ============================================================================ */

export const SITE_DATA = {
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
  // Необязательное поле link: внешняя (https://…) или внутренняя (wiki/article.html?p=…)
  // ссылка строкой либо объектом { ru, en }. Заголовок становится ссылкой, а клик
  // в любом месте карточки открывает материал.
  // ---------------------------------------------------------------------------
  news: [
    {
      date: "2026-09-17",
      tag: "news",
      link: "wiki/",
      ru: {
        title: "Вики WWN: лор, фракции и гайды",
        text: "История галактики, фракции, юниты и руководства — в отдельном разделе сайта. Начни с обзора вселенной WWN."
      },
      en: {
        title: "WWN wiki: lore, factions and guides",
        text: "Galaxy history, factions, units and guides — in a dedicated section of the site. Start with the WWN universe overview."
      }
    },
    {
      date: "2026-08-20",
      tag: "news",
      link: "https://steamcommunity.com/sharedfiles/filedetails/?id=3247893564",
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
