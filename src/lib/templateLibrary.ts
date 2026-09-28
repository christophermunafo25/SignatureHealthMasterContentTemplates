// Organizes a template list for browsing: category and holiday filters,
// search, and the grouped sections the galleries render. Pure, so the
// facility library and the team gallery share one behavior and it can be
// tested without a DOM.

import { daysUntil, holidayForTags, nextOccurrence, type Holiday } from "./holidays";
import type { TemplateSchema } from "./types";

/** Holidays within this many days lead the unfiltered view. Eight-ish weeks
 * gives facilities time to plan: Thanksgiving shows up by late September. */
export const COMING_UP_DAYS = 60;

export type LibraryTemplate = Pick<TemplateSchema, "name" | "description" | "category" | "tags">;

export interface LibraryFilter {
  query: string;
  /** Exact category name, or null for every category. */
  category: string | null;
  /** Holiday key, or null for every holiday. */
  holiday: string | null;
}

export const EMPTY_FILTER: LibraryFilter = { query: "", category: null, holiday: null };

export interface CategoryOption {
  name: string;
  count: number;
}

export interface HolidayOption {
  key: string;
  label: string;
  count: number;
  date: Date;
}

export interface LibrarySection<T> {
  key: string;
  /** Null when the view is a single flat list. */
  title: string | null;
  /** Holiday sections carry their next date; the UI formats it. */
  date?: Date;
  comingUp?: boolean;
  templates: T[];
}

export interface OrganizedLibrary<T> {
  categories: CategoryOption[];
  /** Holiday chips for the selected category. Empty unless a category is
   * selected and it spans at least two holidays. */
  holidays: HolidayOption[];
  sections: LibrarySection<T>[];
  /** Templates in view after every filter. */
  total: number;
}

export function isFiltered(f: LibraryFilter): boolean {
  return f.query.trim() !== "" || f.category !== null || f.holiday !== null;
}

/** Lowercase, with tag hyphens read as spaces: "new year" finds `new-year`. */
const normalize = (s: string) => s.toLowerCase().replace(/[-_]+/g, " ");

function matchesQuery(t: LibraryTemplate, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  return (
    normalize(t.name).includes(n) ||
    normalize(t.description).includes(n) ||
    normalize(t.category).includes(n) ||
    // Every tag and every holiday it names, not just the one the template
    // files under: a Christmas + New Year card answers to both.
    t.tags.some(
      (tag) =>
        normalize(tag).includes(n) ||
        (holidayForTags([tag])?.label.toLowerCase().includes(n) ?? false),
    )
  );
}

const byName = <T extends LibraryTemplate>(a: T, b: T) => a.name.localeCompare(b.name);

/** Categories with counts, largest first. Blank categories are left out. */
export function categoryOptions(templates: readonly LibraryTemplate[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const t of templates) {
    const c = t.category.trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

interface HolidayGroup<T> {
  holiday: Holiday;
  date: Date;
  templates: T[];
}

/** Splits templates into holiday groups (soonest first) and the rest. */
function splitByHoliday<T extends LibraryTemplate>(
  templates: readonly T[],
  now: Date,
): { groups: HolidayGroup<T>[]; other: T[] } {
  const groups = new Map<string, HolidayGroup<T>>();
  const other: T[] = [];
  for (const t of templates) {
    const holiday = holidayForTags(t.tags);
    if (!holiday) {
      other.push(t);
      continue;
    }
    let g = groups.get(holiday.key);
    if (!g) {
      g = { holiday, date: nextOccurrence(holiday, now), templates: [] };
      groups.set(holiday.key, g);
    }
    g.templates.push(t);
  }
  const sorted = [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const g of sorted) g.templates.sort(byName);
  return { groups: sorted, other: other.sort(byName) };
}

const holidaySection = <T>(g: HolidayGroup<T>, now: Date): LibrarySection<T> => ({
  key: `holiday:${g.holiday.key}`,
  title: g.holiday.label,
  date: g.date,
  comingUp: daysUntil(g.date, now) <= COMING_UP_DAYS,
  templates: g.templates,
});

export function organizeLibrary<T extends LibraryTemplate>(
  templates: readonly T[],
  filter: LibraryFilter,
  now: Date = new Date(),
): OrganizedLibrary<T> {
  const categories = categoryOptions(templates);
  const q = filter.query.trim().toLowerCase();

  const inCategory = filter.category === null
    ? [...templates]
    : templates.filter((t) => t.category.trim() === filter.category);

  const holidays: HolidayOption[] =
    filter.category === null
      ? []
      : splitByHoliday(inCategory, now).groups.map((g) => ({
          key: g.holiday.key,
          label: g.holiday.label,
          count: g.templates.length,
          date: g.date,
        }));

  const pool = inCategory.filter(
    (t) =>
      (filter.holiday === null || holidayForTags(t.tags)?.key === filter.holiday) &&
      matchesQuery(t, q),
  );

  let sections: LibrarySection<T>[];
  if (q || filter.holiday !== null) {
    // Searching or narrowed to one holiday: one flat list, soonest holiday
    // first, everything else by name after it.
    const { groups, other } = splitByHoliday(pool, now);
    sections = [{ key: "results", title: null, templates: [...groups.flatMap((g) => g.templates), ...other] }];
  } else {
    const { groups, other } = splitByHoliday(pool, now);
    if (filter.category === null) {
      // Everything: holidays coming up first, then each everyday category,
      // then the rest of the year's holidays in calendar order.
      const soon = groups.filter((g) => daysUntil(g.date, now) <= COMING_UP_DAYS);
      const later = groups.filter((g) => daysUntil(g.date, now) > COMING_UP_DAYS);
      const byCategory = new Map<string, T[]>();
      for (const t of other) {
        const c = t.category.trim() || "More templates";
        byCategory.set(c, [...(byCategory.get(c) ?? []), t]);
      }
      const order = new Map(categories.map((c, i) => [c.name, i]));
      const everyday = [...byCategory.entries()]
        .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
        .map(([name, list]): LibrarySection<T> => ({ key: `category:${name}`, title: name, templates: list }));
      sections = [
        ...soon.map((g) => holidaySection(g, now)),
        ...everyday,
        ...later.map((g) => holidaySection(g, now)),
      ];
    } else {
      // One category: its everyday templates, then its holidays by date.
      sections = [
        ...(other.length > 0
          ? [{ key: `category:${filter.category}`, title: filter.category, templates: other }]
          : []),
        ...groups.map((g) => holidaySection(g, now)),
      ];
    }
    // A lone section needs no heading.
    if (sections.length === 1) sections = [{ ...sections[0], title: null }];
  }

  return {
    categories,
    holidays: holidays.length >= 2 ? holidays : [],
    sections: sections.filter((s) => s.templates.length > 0),
    total: pool.length,
  };
}
