/* ============================================================================
   WWN — конфигурация сайта (ES-модуль)
   ----------------------------------------------------------------------------
   Единственный файл, который нужно править для ссылок, версии, новостей и т.д.
   ============================================================================ */

export const WWN_CONFIG = {
  // Version shown in the header badge and download section
  version: "1.0.0",
  updated: "2026-09-15",

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
    youtube: "",
    telegram: "",
    vk: "",
    gitlab: "https://gitlab.com/wwn.games/wwn.mod-rustedwarfare/WWN-Mod",
    // Steam page of the base game (Rusted Warfare)
    gameSteam: "https://store.steampowered.com/app/241100/Rusted_Warfare/",
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
  // NEWS — short cards in the "What's new" section. Add/remove freely.
  // ---------------------------------------------------------------------------
  news: [
    {
      date: "2026-09-15",
      tag: "update",
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
      date: "2026-09-01",
      tag: "league",
      ru: {
        title: "Сезон WWN League",
        text: "Соревновательные матчи, фиксированный пул карт и рейтинг игроков — правила в вики."
      },
      en: {
        title: "WWN League season",
        text: "Competitive matches, a fixed map pool and player ratings — rules in the wiki."
      }
    },
    {
      date: "2026-08-20",
      tag: "balance",
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
  // GALLERY — images from assets/img. caption is localised.
  // ---------------------------------------------------------------------------
  gallery: [
    {
      src: "assets/img/gallery/screenshot-1.webp",
      wide: true,
      ru: { caption: "Ядерный удар: позиции противника накрыты с орбиты" },
      en: { caption: "Nuclear strike: enemy positions hit from orbit" }
    },
    // Пример (раскомментируйте и заполните):
    // {
    //   src: "assets/img/gallery/screenshot-1.webp",   // путь от корня сайта
    //   wide: true,                                    // опционально: широкая плитка
    //   tall: false,                                   // опционально: высокая плитка
    //   ru: { caption: "Подпись на русском" },
    //   en: { caption: "Caption in English" }
    // }
  ],

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------
  discordInvite: "https://discord.gg/sRwKDGrbDy",
  siteName: "WWN",
  siteTagline: {
    ru: "Мод для Rusted Warfare",
    en: "A Rusted Warfare mod"
  }
};
