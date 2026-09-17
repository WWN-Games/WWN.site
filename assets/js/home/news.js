/* ============================================================================
   WWN — новости главной: карточки из site-data.js.
   ============================================================================ */

import { $, formatDate, loc, locObj } from "../utils.js";

/* Ссылка новости: строка или { ru, en }. Внешние — только http(s), всё остальное
   считаем относительным путём; javascript:/data: и прочие схемы отсекаем. */
const EXTERNAL = /^https?:\/\//i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function newsLink(value, lang) {
  const raw = value && typeof value === "object" ? value[lang] ?? value.ru ?? value.en : value;
  if (typeof raw !== "string") return "";
  const url = raw.trim();
  if (!url || (HAS_SCHEME.test(url) && !EXTERNAL.test(url))) return "";
  return url;
}

export function renderNews(config, lang) {
  const grid = $("#newsGrid");
  if (!grid) return;

  grid.replaceChildren(
    ...(config.news || []).map((item) => {
      const localized = locObj(item, lang);
      const card = document.createElement("article");
      card.className = "news__card";

      const meta = document.createElement("div");
      meta.className = "news__meta";

      const tagName = String(item.tag || "update").replace(/[^\w-]/g, "");
      const tag = document.createElement("span");
      tag.className = `tag${tagName !== "update" ? ` tag--${tagName}` : ""}`;
      tag.textContent = loc(config.newsTags?.[tagName], lang) || tagName;

      const time = document.createElement("time");
      time.dateTime = item.date || "";
      time.textContent = item.date ? formatDate(item.date, lang) : "";

      meta.append(tag, time);

      const title = document.createElement("h3");
      const href = newsLink(item.link, lang);
      if (href) {
        const isExternal = EXTERNAL.test(href);
        const link = document.createElement("a");
        link.href = href;
        link.textContent = localized.title || "";
        // невидимая область ссылки растянута на всю карточку (см. .news__link::after)
        link.className = isExternal ? "news__link news__link--external" : "news__link";
        if (isExternal) {
          link.target = "_blank";
          link.rel = "noopener";
          const arrow = document.createElement("span");
          arrow.className = "news__arrow";
          arrow.setAttribute("aria-hidden", "true");
          arrow.textContent = "↗";
          link.append(arrow);
        }
        title.append(link);
      } else {
        title.textContent = localized.title || "";
      }
      const text = document.createElement("p");
      text.textContent = localized.text || "";

      card.append(meta, title, text);
      return card;
    })
  );
}
