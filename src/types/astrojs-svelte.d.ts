/* Реальные типы @astrojs/svelte тянут legacy-объявление `*.svelte` из svelte,
   которое конфликтует с src/types/svelte-component.d.ts. Для tsc достаточно
   фабрики интеграции; сам конфиг Astro проверяется при сборке. */
import type { AstroIntegration } from "astro";

export default function svelte(options?: Record<string, unknown>): AstroIntegration;
