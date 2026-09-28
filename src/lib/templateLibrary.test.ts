import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, organizeLibrary, type LibraryTemplate } from "./templateLibrary";

// Today, for these tests: Sept 28, 2026. Halloween is 33 days out,
// Thanksgiving (Nov 26) 59, Hanukkah (Dec 4) 67.
const NOW = new Date(2026, 8, 28);

const t = (name: string, category: string, tags: string[]): LibraryTemplate => ({
  name,
  description: "",
  category,
  tags,
});

const LIBRARY = [
  t("Happy Birthday", "Celebrations", ["birthday"]),
  t("Meet the Team", "Recognition", ["team"]),
  t("Stakeholder Spotlight", "Recognition", ["spotlight"]),
  t("Easter Botanical", "Holidays", ["easter", "holiday"]),
  t("Halloween Ghost Pattern", "Holidays", ["halloween", "holiday"]),
  t("Christmas Gifts", "Holidays", ["christmas", "new-year", "holiday"]),
  t("Thanksgiving Blessed", "Holidays", ["thanksgiving", "holiday"]),
  t("Hanukkah Menorah", "Holidays", ["hanukkah", "holiday"]),
  t("Thanksgiving Autumn Garland", "Holidays", ["thanksgiving", "holiday"]),
];

const titles = (filter = EMPTY_FILTER) =>
  organizeLibrary(LIBRARY, filter, NOW).sections.map((s) => s.title);

describe("organizeLibrary — unfiltered", () => {
  it("leads with holidays coming up, then everyday categories, then the rest of the year", () => {
    expect(titles()).toEqual([
      "Halloween",
      "Thanksgiving",
      "Recognition",
      "Celebrations",
      "Hanukkah",
      "Christmas",
      "Easter",
    ]);
  });

  it("marks only the near holidays as coming up", () => {
    const sections = organizeLibrary(LIBRARY, EMPTY_FILTER, NOW).sections;
    expect(sections.filter((s) => s.comingUp).map((s) => s.title)).toEqual(["Halloween", "Thanksgiving"]);
  });

  it("sorts templates by name inside a section", () => {
    const thanksgiving = organizeLibrary(LIBRARY, EMPTY_FILTER, NOW).sections[1];
    expect(thanksgiving.templates.map((x) => x.name)).toEqual([
      "Thanksgiving Autumn Garland",
      "Thanksgiving Blessed",
    ]);
  });

  it("lists categories largest first and offers no holiday chips", () => {
    const lib = organizeLibrary(LIBRARY, EMPTY_FILTER, NOW);
    expect(lib.categories).toEqual([
      { name: "Holidays", count: 6 },
      { name: "Recognition", count: 2 },
      { name: "Celebrations", count: 1 },
    ]);
    expect(lib.holidays).toEqual([]);
    expect(lib.total).toBe(LIBRARY.length);
  });

  it("rolls the order forward: in December, Hanukkah and Christmas lead and Halloween is last", () => {
    const december = organizeLibrary(LIBRARY, EMPTY_FILTER, new Date(2026, 11, 1)).sections;
    expect(december.map((s) => s.title)).toEqual([
      "Hanukkah",
      "Christmas",
      "Recognition",
      "Celebrations",
      "Easter",
      "Halloween",
      "Thanksgiving",
    ]);
  });
});

describe("organizeLibrary — filters", () => {
  it("a category shows only its templates, with holiday chips in date order", () => {
    const lib = organizeLibrary(LIBRARY, { ...EMPTY_FILTER, category: "Holidays" }, NOW);
    expect(lib.holidays.map((h) => [h.label, h.count])).toEqual([
      ["Halloween", 1],
      ["Thanksgiving", 2],
      ["Hanukkah", 1],
      ["Christmas", 1],
      ["Easter", 1],
    ]);
    expect(lib.sections.map((s) => s.title)).toEqual(["Halloween", "Thanksgiving", "Hanukkah", "Christmas", "Easter"]);
    expect(lib.total).toBe(6);
  });

  it("a category with one kind of template is a single untitled list", () => {
    const lib = organizeLibrary(LIBRARY, { ...EMPTY_FILTER, category: "Recognition" }, NOW);
    expect(lib.sections).toHaveLength(1);
    expect(lib.sections[0].title).toBeNull();
    expect(lib.holidays).toEqual([]);
  });

  it("a holiday narrows to that holiday's templates", () => {
    const lib = organizeLibrary(LIBRARY, { ...EMPTY_FILTER, category: "Holidays", holiday: "thanksgiving" }, NOW);
    expect(lib.sections).toHaveLength(1);
    expect(lib.sections[0].templates.map((x) => x.name)).toEqual([
      "Thanksgiving Autumn Garland",
      "Thanksgiving Blessed",
    ]);
  });

  it("search matches the holiday's label, not just its tag", () => {
    const lib = organizeLibrary(LIBRARY, { ...EMPTY_FILTER, query: "new year" }, NOW);
    expect(lib.sections[0].templates.map((x) => x.name)).toEqual(["Christmas Gifts"]);
  });

  it("search results put the soonest holiday first, then everyday templates", () => {
    const lib = organizeLibrary(
      [...LIBRARY, t("Holiday Party Recap", "Celebrations", ["party"])],
      { ...EMPTY_FILTER, query: "h" },
      NOW,
    );
    const names = lib.sections[0].templates.map((x) => x.name);
    expect(names.indexOf("Halloween Ghost Pattern")).toBeLessThan(names.indexOf("Easter Botanical"));
    expect(names.indexOf("Easter Botanical")).toBeLessThan(names.indexOf("Happy Birthday"));
  });

  it("search stays inside the selected category", () => {
    const lib = organizeLibrary(LIBRARY, { query: "spotlight", category: "Holidays", holiday: null }, NOW);
    expect(lib.total).toBe(0);
    expect(lib.sections).toEqual([]);
  });
});
