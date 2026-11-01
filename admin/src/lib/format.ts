const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(value: string): string {
  return [...value.toLowerCase()]
    .map((char) => CYRILLIC[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function assetUrl(path: string | undefined): string {
  if (!path) return "";
  if (path.startsWith("/media/") || path.startsWith("http")) return path;
  const clean = path.replace(/^\/+/, "").replace(/^src\//, "");
  if (clean.startsWith("assets/")) return `/media/assets/${clean.slice("assets/".length)}`;
  if (clean.startsWith("img/")) return `/media/public/${clean}`;
  return `/media/public/${clean}`;
}

export function cardImageUrl(item: { id: string; image?: string }): string {
  if (item.image === "") return "";
  if (item.image) return assetUrl(item.image);
  return `/media/public/img/database/${item.id}.avif`;
}

export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
