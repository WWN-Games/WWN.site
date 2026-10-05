/* ============================================================================
   WWN — имена иконок Phosphor для разделов вики.
   id раздела приходит из src/data/sections.json (валидируется Zod-схемой).
   ============================================================================ */

const SECTION_ICON_NAMES: Record<string, string> = {
  book: "ph:book",
  shield: "ph:shield",
  cube: "ph:cube",
  gear: "ph:gear",
  compass: "ph:compass",
  users: "ph:users",
  clock: "ph:clock",
  rocket: "ph:rocket",
  chat: "ph:chat",
};

export function sectionIconName(id: string): string {
  return SECTION_ICON_NAMES[id] ?? "ph:book";
}
