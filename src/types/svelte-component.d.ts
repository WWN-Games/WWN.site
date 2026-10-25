/* tsc не преобразует .svelte, поэтому пропсы островов проверяет Svelte-компилятор
   при сборке Astro. Здесь достаточно сигнатуры, принимающей любые пропсы. */
declare module "*.svelte" {
  const component: (props: Record<string, unknown>) => unknown;
  export default component;
}
