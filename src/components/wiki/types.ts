/* ============================================================================
   WWN — типы компонентов вики, выведенные из функций @/lib/wiki.
   ============================================================================ */

import type { getNav, getStats, WikiEntry } from "@/lib/wiki";

export type WikiNav = Awaited<ReturnType<typeof getNav>>;
export type WikiStats = Awaited<ReturnType<typeof getStats>>;
export type { WikiEntry };
