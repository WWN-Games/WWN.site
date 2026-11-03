/* Минимальные типы Svelte-рун для обычного tsc: .svelte-файлы проверяет
   svelte-check/компилятор Vite, а .svelte.ts с $state должен видеть tsc. */
declare function $state<T>(value: T): T;
declare function $derived<T>(value: T): T;
declare function $effect(fn: () => unknown): void;
