/* ============================================================================
   WWN — SVG-строка IconPark для Svelte-островов.
   @icon-park/svg возвращает строку с XML-декларацией; в HTML она не нужна,
   а класс нужен там, где размер/поворот задаёт CSS.
   ============================================================================ */

import type { Icon } from "@icon-park/svg/lib/runtime";

export function iconSvg(render: Icon, className?: string): string {
  const svg = render({}).replace(/^<\?xml[^>]*\?>\s*/, "");
  return className ? svg.replace("<svg ", `<svg class="${className}" `) : svg;
}
