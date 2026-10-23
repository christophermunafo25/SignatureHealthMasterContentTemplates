import { describe, expect, it } from "vitest";
import { HALL_OF_FAME_TEMPLATES } from "@/lib/hallOfFame";
import { pathFor, routeFor } from "./router";

describe("Hall of Fame routes", () => {
  it("routes the library both ways", () => {
    expect(routeFor("/hall-of-fame-submission")).toEqual({ name: "hallOfFame" });
    expect(routeFor("/hall-of-fame-submission/")).toEqual({ name: "hallOfFame" });
    expect(pathFor({ name: "hallOfFame" })).toBe("/hall-of-fame-submission");
  });

  it("routes every template's fill page both ways", () => {
    for (const t of HALL_OF_FAME_TEMPLATES) {
      const path = pathFor({ name: "hallOfFameTemplate", templateId: t.id });
      expect(path).toBe(`/hall-of-fame-submission/${t.id}`);
      expect(routeFor(path)).toEqual({ name: "hallOfFameTemplate", templateId: t.id });
    }
  });

  it("keeps links to the first path working", () => {
    expect(routeFor("/hall-of-fame")).toEqual({ name: "hallOfFame" });
    expect(routeFor("/hall-of-fame/classic-photo-name")).toEqual({
      name: "hallOfFameTemplate",
      templateId: "classic-photo-name",
    });
  });

  it("leaves the portal routes where they were", () => {
    expect(routeFor("/")).toEqual({ name: "publicHome" });
    expect(routeFor("/browse")).toEqual({ name: "publicHomeLibrary" });
    expect(routeFor("/p/abc")).toEqual({ name: "publicHomeTemplate", templateId: "abc" });
    expect(routeFor("/admin")).toEqual({ name: "portal" });
    expect(routeFor("/g/abc")).toEqual({ name: "publicPortal", token: "abc" });
    expect(routeFor("/not-a-page")).toEqual({ name: "portal" });
  });
});
