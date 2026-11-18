import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const root = import.meta.dirname;
const siteRoot = path.resolve(root, "..");

export default defineConfig({
  root,
  plugins: [svelte()],
  server: {
    middlewareMode: true,
    fs: {
      allow: [siteRoot, root],
    },
  },
  appType: "spa",
});
