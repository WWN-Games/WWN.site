/* ============================================================================
   WWN — главная страница: только сборка блоков. Логика — в assets/js/home/*.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, onLangChange, registerI18n, t } from "./i18n.js";
import { HOME_I18N } from "./i18n/home.js";
import { $, debounce } from "./utils.js";
import { initHeader, initReveal, resolveLinks } from "./ui.js";
import { initHero } from "./home/hero.js";
import { initGalleryUi, renderGallery } from "./home/gallery.js";
import { renderNews } from "./home/news.js";
import { initFaq, syncFaqHeights } from "./home/faq.js";
import { initStats, syncStats } from "./home/stats.js";

registerI18n(HOME_I18N);

const cfg = WWN_CONFIG;

function refreshDynamic(lang) {
  renderGallery(cfg, lang);
  renderNews(cfg, lang);
  syncFaqHeights();
  resolveLinks(cfg);
  document.title = t("meta.title.home", lang);
}

function boot() {
  const lang = bootI18n();
  initHeader();
  resolveLinks(cfg);
  initHero();
  initGalleryUi();
  initFaq();
  initStats(cfg);
  initReveal();
  refreshDynamic(lang);

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  onLangChange((next) => {
    refreshDynamic(next);
    syncStats(next);
  });
  window.addEventListener("resize", debounce(syncFaqHeights, 150));
}

boot();
