/* ============================================================================
   WWN — импорт каталога карт из maps/*.tmx и *_map.png.
   ============================================================================ */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { MOD_ROOT, SITE_ROOT } from "./source.ts";

export interface MapItem {
  id: string;
  order: number;
  name: { ru: string; en: string };
  desc: { ru: string; en: string };
  image: string;
  players: number;
  size: { ru: string; en: string };
  mode: { ru: string; en: string };
}

const NAMES: Record<string, { ru: string; en: string }> = {
  "1v1_Fionfe": { ru: "Фионфе", en: "Fionfe" },
  "1v1_Klasta Aspera": { ru: "Класта Аспера", en: "Klasta Aspera" },
  "1v1_Oreza": { ru: "Ореза", en: "Oreza" },
  "1v1_Sartasta": { ru: "Сартаста", en: "Sartasta" },
  "1v1v1_Tartum": { ru: "Тартум", en: "Tartum" },
  "2v2 Klasta Goliath": { ru: "Класта Голиаф", en: "Klasta Goliath" },
  "2v2_Balata": { ru: "Балата", en: "Balata" },
  "2v2_Nutriousmstex": { ru: "Нутриусмстекс", en: "Nutriousmstex" },
  "2v2_Protalina": { ru: "Проталина", en: "Protalina" },
  "3v3_Kerast": { ru: "Кераст", en: "Kerast" },
  "3v3_Lotra": { ru: "Лотра", en: "Lotra" },
  "4v4_Korganer": { ru: "Корганер", en: "Korganer" },
  "5v5_Iatarius": { ru: "Иатариус", en: "Iatarius" },
};

const PLAYERS: Record<string, number> = {
  "1v1": 2,
  "1v1v1": 3,
  "2v2": 4,
  "3v3": 6,
  "4v4": 8,
  "5v5": 10,
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function modeLabel(mode: string): string {
  return mode.replace(/v/gi, " на ");
}

export async function buildMaps(writeImages: boolean): Promise<MapItem[]> {
  const dir = path.join(MOD_ROOT, "maps");
  const imagesDir = path.join(SITE_ROOT, "public/img/maps");
  if (writeImages) mkdirSync(imagesDir, { recursive: true });

  const files = readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".tmx"))
    .sort((a, b) => a.localeCompare(b));

  const items: MapItem[] = [];
  const conversions: Array<Promise<unknown>> = [];
  for (const [index, file] of files.entries()) {
    const stem = path.basename(file, ".tmx").replace(/^WWN_/, "");
    const separator = stem.search(/[_\s]/);
    const mode = separator === -1 ? stem : stem.slice(0, separator);
    const title = separator === -1 ? stem : stem.slice(separator + 1);
    const name = NAMES[stem] ?? { ru: title, en: title };
    const id = `${slug(mode)}-${slug(title)}`;
    const tmx = readFileSync(path.join(dir, file), "utf8");
    const header = /<map[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/i.exec(tmx);
    const width = header ? Number(header[1]) : 0;
    const height = header ? Number(header[2]) : 0;
    const players = PLAYERS[mode] ?? 2;
    const label = modeLabel(mode);
    const imageName = `${path.basename(file, ".tmx")}_map.png`;
    const imageSource = path.join(dir, imageName);

    if (writeImages && existsSync(imageSource)) {
      const target = path.join(imagesDir, `${id}.avif`);
      conversions.push(
        sharp(imageSource)
          .resize({ width: 800, withoutEnlargement: true })
          .avif({ quality: 80, effort: 4 })
          .toFile(target)
          .catch((error: unknown) => {
            console.warn(`не удалось сконвертировать ${imageName}:`, error);
          }),
      );
    }

    items.push({
      id,
      order: index + 1,
      name,
      desc: {
        ru: `Карта для ${label}`,
        en: `A ${label} map`,
      },
      image: `img/maps/${id}.avif`,
      players,
      size: { ru: `${width}×${height}`, en: `${width}×${height}` },
      mode: { ru: mode, en: mode },
    });
  }

  await Promise.all(conversions);
  return items;
}

export function writeMaps(items: MapItem[]): void {
  const file = path.join(SITE_ROOT, "src/data/maps.json");
  const current = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...current, maps: items }, null, 2)}\n`, "utf8");
}
