import { describe, expect, it } from "vitest";

import { parseArticleFrontMatter, serializeArticleFrontMatter } from "../../src/lib/frontmatter";

describe("frontmatter", () => {
  it("квотирует timestamp-подобные строки, чтобы Astro не превратил их в Date", () => {
    const raw = serializeArticleFrontMatter(
      {
        title: "2026-01-01",
        desc: "2026-01-01T12:00:00Z",
        order: 1,
        updated: "2026-01-01",
        draft: false,
      },
      "Текст",
    );
    expect(raw).toContain('title: "2026-01-01"');
    expect(raw).toContain('desc: "2026-01-01T12:00:00Z"');
    const parsed = parseArticleFrontMatter(raw);
    expect(parsed.data.title).toBe("2026-01-01");
    expect(parsed.data.updated).toBe("2026-01-01");
    expect(parsed.body.trim()).toBe("Текст");
  });

  it("читает unquoted updated как Date, как это делает Astro", () => {
    const parsed = parseArticleFrontMatter(
      "---\ntitle: Тест\ndesc: Описание\norder: 1\nupdated: 2026-01-01\ndraft: false\n---\n\nТекст",
    );
    expect(parsed.data.updated).toBeInstanceOf(Date);
  });
});
