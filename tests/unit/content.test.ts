import { describe, expect, it } from "vitest";

import { validateContent } from "../../scripts/validate-content.ts";

describe("content", () => {
  it("валидирует вики и данные без ошибок", () => {
    const errors = validateContent();
    expect(errors).toEqual([]);
  });
});
