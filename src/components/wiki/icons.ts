/* ============================================================================
   WWN — имена иконок Phosphor для разделов вики.
   id раздела приходит из src/data/sections.json (валидируется Zod-схемой).
   ============================================================================ */

import type { SECTION_ICONS } from "@/lib/content-constants";

const SECTION_ICON_NAMES = {
  book: "icon-park-outline:book",
  shield: "icon-park-outline:shield",
  cube: "icon-park-outline:cube",
  gear: "icon-park-outline:setting-two",
  compass: "icon-park-outline:compass",
  users: "icon-park-outline:peoples",
  clock: "icon-park-outline:time",
  rocket: "icon-park-outline:rocket",
  chat: "icon-park-outline:message",
} satisfies Record<(typeof SECTION_ICONS)[number], string>;

export function sectionIconName(id: string): string {
  return SECTION_ICON_NAMES[id as keyof typeof SECTION_ICON_NAMES] ?? "icon-park-outline:book";
}
