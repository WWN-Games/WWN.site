import { describe, expect, it } from "vitest";

import { ftlListTagKeys } from "../../src/lib/ftl";

describe("FTL tags", () => {
  it("не показывает технические подробности в общем списке", () => {
    expect(ftlListTagKeys("siv")).toEqual([]);
    expect(ftlListTagKeys("tele")).toEqual([]);
    expect(ftlListTagKeys("plasma")).toEqual(["database.ability.ftl.tag.gasRecharge"]);
  });
});
