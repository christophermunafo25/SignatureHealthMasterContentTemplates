import { describe, expect, it } from "vitest";
import { HOLIDAYS, daysUntil, holidayForTags, nextOccurrence } from "./holidays";

const on = (key: string, year: number) => {
  const h = HOLIDAYS.find((x) => x.key === key)!;
  const d = h.on(year);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("holiday dates", () => {
  it("computes the moving holidays", () => {
    expect(on("thanksgiving", 2026)).toBe("2026-11-26");
    expect(on("thanksgiving", 2027)).toBe("2027-11-25");
    expect(on("easter", 2026)).toBe("2026-04-05");
    expect(on("easter", 2027)).toBe("2027-03-28");
    expect(on("mothers-day", 2027)).toBe("2027-05-09");
    expect(on("presidents-day", 2027)).toBe("2027-02-15");
    expect(on("memorial-day", 2027)).toBe("2027-05-31");
    expect(on("labor-day", 2026)).toBe("2026-09-07");
    expect(on("grandparents-day", 2026)).toBe("2026-09-13");
  });

  it("finds the first night of Hanukkah from the Hebrew calendar", () => {
    expect(on("hanukkah", 2025)).toBe("2025-12-14");
    expect(on("hanukkah", 2026)).toBe("2026-12-04");
    expect(on("hanukkah", 2027)).toBe("2027-12-24");
  });
});

describe("nextOccurrence", () => {
  const halloween = HOLIDAYS.find((h) => h.key === "halloween")!;

  it("keeps the holiday upcoming through its own day", () => {
    expect(nextOccurrence(halloween, new Date(2026, 9, 31, 18)).getFullYear()).toBe(2026);
  });

  it("rolls to next year the day after", () => {
    expect(nextOccurrence(halloween, new Date(2026, 10, 1)).getFullYear()).toBe(2027);
  });

  it("counts whole days", () => {
    expect(daysUntil(nextOccurrence(halloween, new Date(2026, 8, 28)), new Date(2026, 8, 28, 23))).toBe(33);
  });
});

describe("holidayForTags", () => {
  it("uses the first matching tag, so a Christmas + New Year card files under Christmas", () => {
    expect(holidayForTags(["christmas", "new-year", "holiday"])?.key).toBe("christmas");
  });

  it("resolves aliases", () => {
    expect(holidayForTags(["independence-day", "holiday"])?.key).toBe("4th-of-july");
  });

  it("returns null for everyday templates", () => {
    expect(holidayForTags(["birthday", "celebration"])).toBeNull();
  });
});
