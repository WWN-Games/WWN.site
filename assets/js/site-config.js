/* ============================================================================
   WWN — конфигурация сайта (ES-модуль)
   ----------------------------------------------------------------------------
   Единственный файл, который нужно править для ссылок, версии, новостей и т.д.
   ============================================================================ */

export const WWN_CONFIG = {
  // Version shown in the header badge
  version: "1.0.0",

  // ---------------------------------------------------------------------------
  // LINKS — replace the placeholders below with real URLs
  // ---------------------------------------------------------------------------
  links: {
    // Steam Workshop page of the mod
    steam: "https://steamcommunity.com/sharedfiles/filedetails/?id=3247893564",
    // Google Drive file with the mod archive
    drive: "https://drive.google.com/file/d/1a3r6f3GG2pORNaqzCVBrsTKvrXs_ctYg/view?usp=sharing",
    // Community links (leave "" to hide the button automatically)
    discord: "https://discord.gg/sRwKDGrbDy",
    youtube: "https://www.youtube.com/@shykinc4860",
    telegram: "",
    vk: "",
    gitlab: "https://gitlab.com/wwn.games/wwn.mod-rustedwarfare/WWN-Mod",
    github: ""
  },

  // ---------------------------------------------------------------------------
  // NUMBERS shown in the "stats" strip on the main page (данные из мода v1.1.6b9)
  // ---------------------------------------------------------------------------
  stats: {
    units: 178,
    factions: 2,
    maps: 13,
    races: 8
  },

  // ---------------------------------------------------------------------------
  // NEWS TAGS — доступные теги для news[].tag: id + подпись на двух языках.
  // Цвет задаётся классом .tag--<id> в assets/css/style.css
  // (для update отдельного класса нет — используется базовый .tag).
  // ---------------------------------------------------------------------------
  newsTags: {
    update: { ru: "Обновление", en: "Update" },
    news: { ru: "Новости", en: "News" },
    balance: { ru: "Баланс", en: "Balance" },
    league: { ru: "Лига", en: "League" },
    fix: { ru: "Фикс", en: "Fix" }
  },

  // ---------------------------------------------------------------------------
  // NEWS — short cards in the "What's new" section. Add/remove freely.
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
    }
  ],

  // ---------------------------------------------------------------------------
  // GALLERY — images from assets/img/gallery. caption is localised.
  // Optional keys: wide (2 columns), tall (2 rows), srcEn (English-only image).
  // ---------------------------------------------------------------------------
  gallery: [
    {
      src: "assets/img/gallery/screenshot-1.webp",
      wide: true,
      ru: { caption: "Ядерный удар" },
      en: { caption: "Nuclear strike" }
    },
    {
      src: "assets/img/gallery/screenshot-2.webp",
      ru: { caption: "Фензем юниты" },
      en: { caption: "Fenearth units" }
    },
    {
      src: "assets/img/gallery/screenshot-3.webp",
      ru: { caption: "Протон юниты" },
      en: { caption: "Proton units" }
    }
  ]
};
