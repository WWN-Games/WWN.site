/* ============================================================================
   WWN — проверка типов через tsc (TypeScript 7) и Astro content mapper.
   astro check не поддерживает TypeScript 7, поэтому .astro проверяет
   @astrojs/ts-content-mapper. Диагностика из node_modules (собранные .astro
   компоненты Astro не рассчитаны на exactOptionalPropertyTypes и
   noUncheckedIndexedAccess) отфильтровывается — ошибки самого проекта
   по-прежнему валят проверку.
   ============================================================================ */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");

const result = spawnSync(
  process.execPath,
  [TSC, "--noEmit", "--runExternalCode", "--pretty", "false"],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const lines = output.split(/\r?\n/);
const kept: string[] = [];
let skipBlock = false;
let filteredDependencyErrors = 0;

const diagnostic = /^(.+?)\(\d+,\d+\): (?:error|warning) TS\d+:/;

for (const line of lines) {
  const header = diagnostic.exec(line);
  if (header) {
    const file = (header[1] ?? "").split(path.sep).join("/");
    skipBlock = file.includes("/node_modules/") || file.startsWith("node_modules/");
    if (skipBlock && line.includes(": error TS")) filteredDependencyErrors++;
  } else if (line !== "" && !/^\s/.test(line)) {
    // Глобальные ошибки tsc идут без заголовка файла — их нельзя терять.
    skipBlock = false;
  }
  if (!skipBlock && line !== "") kept.push(line);
}

if (kept.length > 0) console.log(kept.join("\n"));

if (result.error) {
  console.error(`typecheck: не удалось запустить tsc — ${result.error.message}`);
  process.exit(1);
}

if (result.status === 0) {
  console.log("typecheck: OK");
  process.exit(0);
}

if (kept.length > 0) {
  console.error("typecheck: найдены ошибки типов");
  process.exit(1);
}

if (result.status !== null && filteredDependencyErrors > 0) {
  console.log("typecheck: OK (диагностика node_modules пропущена)");
  process.exit(0);
}

console.error(`typecheck: tsc завершился с кодом ${result.status ?? "unknown"}`);
process.exit(1);
