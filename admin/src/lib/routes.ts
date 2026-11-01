export type Route =
  | { view: "dashboard" }
  | { view: "articles"; section?: string }
  | { view: "article"; slug?: string; section?: string }
  | { view: "collections"; name: string }
  | { view: "item"; name: string; id?: string }
  | { view: "validation" }
  | { view: "git" };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = (pathPart ?? "").split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart);

  if (parts.length === 0) return { view: "dashboard" };
  if (parts[0] === "articles") {
    if (parts[1] === "new") {
      return { view: "article", section: query.get("section") ?? undefined };
    }
    const slug = parts.slice(1).join("/");
    return { view: "articles", section: slug || undefined };
  }
  if (parts[0] === "article") {
    const slug = parts.slice(1).join("/");
    return { view: "article", slug: slug || undefined };
  }
  if (parts[0] === "collections") {
    const name = parts[1] ?? "units";
    const id = parts.slice(2).join("/");
    if (!id) return { view: "collections", name };
    if (id === "new") return { view: "item", name };
    return { view: "item", name, id };
  }
  if (parts[0] === "validation") return { view: "validation" };
  if (parts[0] === "git") return { view: "git" };
  return { view: "dashboard" };
}

export function routeKey(route: Route): string {
  switch (route.view) {
    case "dashboard":
      return "dashboard";
    case "articles":
      return `articles:${route.section ?? ""}`;
    case "article":
      return `article:${route.slug ?? `new:${route.section ?? ""}`}`;
    case "collections":
      return `collections:${route.name}`;
    case "item":
      return `item:${route.name}:${route.id ?? "new"}`;
    case "validation":
      return "validation";
    case "git":
      return "git";
  }
}
