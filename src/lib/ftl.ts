/* ============================================================================
   WWN — автоматические подписи и теги FTL-прыжка.
   Модуль не зависит от Astro: используется и на сборке, и в Svelte-острове.
   ============================================================================ */

import type { DictKey } from "../i18n";
import type { FtlJumpType } from "./schemas";

export const FTL_TYPE_LABEL: Record<FtlJumpType, DictKey> = {
  siv: "database.ability.ftl.siv",
  plasma: "database.ability.ftl.plasma",
  tele: "database.ability.ftl.tele",
};

/** Теги, которые выводятся автоматически для каждого типа прыжка. */
export const FTL_JUMP_TAGS: Record<FtlJumpType, readonly DictKey[]> = {
  siv: ["database.ability.ftl.tag.move", "database.ability.ftl.tag.bigVisible"],
  plasma: [
    "database.ability.ftl.instant",
    "database.ability.ftl.tag.atmosphere",
    "database.ability.ftl.tag.alwaysVisible",
    "database.ability.ftl.tag.gasRecharge",
  ],
  tele: ["database.ability.ftl.instant", "database.ability.ftl.tag.stealth"],
};

/** Технические подробности прыжка, которые не дублируются в общем списке. */
const FTL_LIST_HIDDEN_TAGS: ReadonlySet<DictKey> = new Set([
  "database.ability.ftl.instant",
  "database.ability.ftl.tag.move",
  "database.ability.ftl.tag.bigVisible",
  "database.ability.ftl.tag.atmosphere",
  "database.ability.ftl.tag.alwaysVisible",
  "database.ability.ftl.tag.stealth",
]);

/** Теги прыжка для карточки общего списка: без технических подробностей. */
export function ftlListTagKeys(type: FtlJumpType): readonly DictKey[] {
  return FTL_JUMP_TAGS[type].filter((key) => !FTL_LIST_HIDDEN_TAGS.has(key));
}

/** Мгновенный прыжок — вместо скорости. */
export function isInstantJump(type: FtlJumpType): boolean {
  return type !== "siv";
}
