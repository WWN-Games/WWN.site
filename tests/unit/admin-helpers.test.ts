import { describe, expect, it } from "vitest";

import { deleteJsonItem, updateJsonItem } from "../../admin/server/json-edit";
import { addMonthsIso, isRealDate } from "../../admin/shared/date";

describe("admin date helpers", () => {
  it("не переполняет конец месяца", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsIso("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("проверяет реальность даты", () => {
    expect(isRealDate("2026-02-28")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
  });
});

describe("точечное редактирование JSON", () => {
  const raw = `{
  "units": [
    { "id": "a", "hp": 10 },
    { "id": "b", "hp": 20 }
  ]
}
`;

  it("заменяет запись и сохраняет остальные", () => {
    const next = updateJsonItem(raw, "units", { id: "a", hp: 30 });
    const parsed = JSON.parse(next) as { units: { id: string; hp: number }[] };
    expect(parsed.units).toEqual([
      { id: "a", hp: 30 },
      { id: "b", hp: 20 },
    ]);
  });

  it("добавляет запись в конец массива", () => {
    const next = updateJsonItem(raw, "units", { id: "c", hp: 30 });
    const parsed = JSON.parse(next) as { units: { id: string }[] };
    expect(parsed.units.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("удаляет запись", () => {
    const next = deleteJsonItem(raw, "units", "a");
    const parsed = JSON.parse(next) as { units: { id: string }[] };
    expect(parsed.units.map((item) => item.id)).toEqual(["b"]);
  });
});
