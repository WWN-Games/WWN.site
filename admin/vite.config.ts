import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
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
