/* ============================================================================
   WWN — новости главной: карточки из site-data.js.
   ============================================================================ */

import { $, formatDate, loc, locObj } from "../utils.js";

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
      title.textContent = localized.title || "";
      const text = document.createElement("p");
      text.textContent = localized.text || "";

      card.append(meta, title, text);
      return card;
    })
  );
}
