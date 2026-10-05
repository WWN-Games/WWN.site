/* ============================================================================
   WWN — имена иконок Phosphor для разделов вики.
   id раздела приходит из src/data/sections.json (валидируется Zod-схемой).
   ============================================================================ */

const SECTION_ICON_NAMES: Record<string, string> = {
  book: "icon-park-outline:book",
  shield: "icon-park-outline:shield",
  cube: "icon-park-outline:cube",
  gear: "icon-park-outline:setting-two",
  compass: "icon-park-outline:compass",
  users: "icon-park-outline:peoples",
  clock: "icon-park-outline:time",
  rocket: "icon-park-outline:rocket",
  chat: "icon-park-outline:message",
};

export function sectionIconName(id: string): string {
  return SECTION_ICON_NAMES[id] ?? "icon-park-outline:book";
}
