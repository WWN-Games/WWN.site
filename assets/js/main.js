/* ============================================================================
   WWN — главная страница: только сборка блоков. Логика — в assets/js/home/*.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, getLang, initLangSwitch, onLangChange, registerDictLoaders, t } from "./i18n.js";
import { debounce } from "./utils.js";
import { initHeader, initReveal, initYear, resolveLinks } from "./ui.js";

registerDictLoaders({
  ru: () => import("./i18n/home.ru.js"),
  en: () => import("./i18n/home.en.js")
});

let cfg = WWN_CONFIG;
let mods = null;

function renderAll() {
  const lang = getLang();
  document.title = t("meta.title.home", lang);
  resolveLinks(cfg);
  if (!mods) return;
  mods.gallery.renderGallery(cfg, lang);
  mods.news.renderNews(cfg, lang);
  mods.faq.syncFaqHeights();
}

async function boot() {
  initHeader();
  initYear();
  initReveal();
  initLangSwitch();
  onLangChange((lang) => {
    renderAll();
    mods?.stats.syncStats(lang);
  });

  await bootI18n();
  renderAll();

  window.addEventListener("resize", debounce(() => mods?.faq.syncFaqHeights(), 150));

  try {
    const [siteData, hero, gallery, news, faq, stats] = await Promise.all([
      import("./site-data.js"),
      import("./home/hero.js"),
      import("./home/gallery.js"),
      import("./home/news.js"),
      import("./home/faq.js"),
      import("./home/stats.js")
    ]);
    cfg = { ...WWN_CONFIG, ...siteData.SITE_DATA };
    mods = { gallery, news, faq, stats };

    hero.initHero();
    gallery.initGalleryUi();
    faq.initFaq();
    stats.initStats();
  } catch (error) {
    console.error("[wwn] блоки главной не загрузились:", error);
    return;
  }

  requestIdleCallback(renderAll, { timeout: 300 });
}

boot();
