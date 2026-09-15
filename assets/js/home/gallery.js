/* ============================================================================
   WWN — галерея главной + лайтбокс (клавиатура, свайпы, прелоад соседей).
   ============================================================================ */

import { $, locObj } from "../utils.js";
import { applyResponsiveImage } from "../media.js";

const GALLERY_SIZES = "(max-width: 580px) 100vw, (max-width: 1120px) 50vw, (max-width: 1400px) 33vw, 25vw";

let items = [];
let index = 0;
let lastFocus = null;

const lightbox = $("#lightbox");
const lightboxImage = $("#lbImg");
const lightboxCaption = $("#lbCap");

export function renderGallery(config, lang) {
  const grid = $("#galleryGrid");
  if (!grid) return;

  const data = config.gallery || [];
  const section = grid.closest("section");
  if (!data.length) {
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;

  items = [];
  grid.replaceChildren(
    ...data.map((item, i) => {
      const localized = locObj(item, lang);
      const src = lang === "en" && item.srcEn ? item.srcEn : item.src;
      const caption = localized.caption || "";
      items.push({ src, caption });

      const figure = document.createElement("figure");
      figure.className = "gallery__item";
      if (item.wide) figure.classList.add("gallery__item--wide");
      if (item.tall) figure.classList.add("gallery__item--tall");
      figure.tabIndex = 0;
      figure.setAttribute("role", "button");
      figure.setAttribute("aria-label", caption);

      const img = document.createElement("img");
      img.alt = caption;
      img.loading = "lazy";
      img.decoding = "async";
      applyResponsiveImage(img, src, GALLERY_SIZES);

      const figcaption = document.createElement("figcaption");
      figcaption.textContent = caption;

      figure.append(img, figcaption);
      figure.addEventListener("click", () => openLightbox(i));
      figure.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(i);
        }
      });
      return figure;
    })
  );

  const many = items.length > 1;
  $("#lbPrev")?.toggleAttribute("hidden", !many);
  $("#lbNext")?.toggleAttribute("hidden", !many);
}

function preloadNeighbors() {
  if (items.length < 2) return;
  for (const offset of [1, -1]) {
    const item = items[(index + offset + items.length) % items.length];
    if (item) new Image().src = item.src;
  }
}

function openLightbox(next) {
  if (!lightbox || !lightboxImage || !items.length) return;
  index = (next + items.length) % items.length;
  const item = items[index];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.caption;
  if (lightboxCaption) lightboxCaption.textContent = item.caption;
  lastFocus = document.activeElement;
  if (!lightbox.open) lightbox.showModal();
  preloadNeighbors();
}

function stepLightbox(direction) {
  if (!items.length) return;
  openLightbox(index + direction);
}

export function initGalleryUi() {
  if (!lightbox) return;
  $("#lbClose")?.addEventListener("click", () => lightbox.close());
  $("#lbPrev")?.addEventListener("click", () => stepLightbox(-1));
  $("#lbNext")?.addEventListener("click", () => stepLightbox(1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") stepLightbox(-1);
    if (event.key === "ArrowRight") stepLightbox(1);
  });
  lightbox.addEventListener("close", () => {
    lightboxImage.removeAttribute("src");
    if (lastFocus instanceof HTMLElement && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  });

  // свайпы по фото (тач и стилус)
  let startX = 0;
  let startY = 0;
  let tracking = false;
  lightbox.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse" || event.target.closest("button")) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    },
    { passive: true }
  );
  lightbox.addEventListener("pointerup", (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
    stepLightbox(dx < 0 ? 1 : -1);
  });
}
