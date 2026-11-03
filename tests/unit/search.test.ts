import { describe, expect, it } from "vitest";

import { highlight, sanitizePagefindExcerpt } from "../../src/lib/search";
import { formatTemplate } from "../../src/lib/utils";

describe("search helpers", () => {
  it("подсвечивает совпадение и экранирует HTML вокруг него", () => {
    expect(highlight("A & B", "&")).toBe("A <mark>&amp;</mark> B");
    expect(highlight("<script>", "script")).toBe("&lt;<mark>script</mark>&gt;");
  });

  it("не разрывает HTML-сущности при подсветке", () => {
    expect(highlight("A &amp; B", "amp")).toBe("A &amp;<mark>amp</mark>; B");
  });

  it("оставляет в excerpt только безопасные mark-теги", () => {
    expect(
      sanitizePagefindExcerpt('x &lt; y <mark class="x">Протон</mark><script>alert(1)</script>'),
    ).toBe("x &lt; y <mark>Протон</mark>alert(1)");
  });
});

describe("formatTemplate", () => {
  it("подставляет значения и не интерпретирует $& в replacement", () => {
    expect(formatTemplate("Добавить «{name}»", { name: "$&" })).toBe("Добавить «$&»");
    expect(formatTemplate("{a} + {b}", { a: 1, b: 2 })).toBe("1 + 2");
    expect(formatTemplate("{missing}", {})).toBe("{missing}");
  });
});
