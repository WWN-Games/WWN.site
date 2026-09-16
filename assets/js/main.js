/* ============================================================================
   WWN — главная страница: только сборка блоков. Логика — в assets/js/home/*.
   Сначала рисуются каркас и переводы; тяжёлые блоки (hero, галерея, новости,
   FAQ, счётчики) подтягиваются асинхронно и не задерживают первый экран.
   ============================================================================ */

import { WWN_CONFIG } from "./site-config.js";
import { bootI18n, onLangChange, registerI18n, t } from "./i18n.js";
import { HOME_I18N } from "./i18n/home.js";
import { debounce } from "./utils.js";
import { initHeader, initReveal, initYear, resolveLinks } from "./ui.js";

registerI18n(HOME_I18N);

const cfg = WWN_CONFIG;
let mods = null;

function applyLang(lang) {
  document.title = t("meta.title.home", lang);
  resolveLinks(cfg);
  if (!mods) return;
  mods.gallery.renderGallery(cfg, lang);
  mods.news.renderNews(cfg, lang);
  mods.faq.syncFaqHeights();
}

async function boot() {
  const lang = bootI18n();
  initHeader();
  initYear();
  initReveal();
  applyLang(lang);

  onLangChange((next) => {
    applyLang(next);
    mods?.stats.syncStats(next);
  });
  window.addEventListener("resize", debounce(() => mods?.faq.syncFaqHeights(), 150));

  const [hero, gallery, news, faq, stats] = await Promise.all([
    import("./home/hero.js"),
    import("./home/gallery.js"),
    import("./home/news.js"),
    import("./home/faq.js"),
    import("./home/stats.js")
  ]);
  mods = { gallery, news, faq, stats };

  hero.initHero();
  gallery.initGalleryUi();
  faq.initFaq();
  stats.initStats(cfg);
  applyLang(lang);
}

boot();
