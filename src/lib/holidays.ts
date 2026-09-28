// Holidays the template library can put on a calendar. A template belongs to
// a holiday through its tags: the first tag that matches a holiday below
// wins, so "Christmas Gifts" (tags christmas, new-year) files under
// Christmas. Nothing is stored — dates are computed, so the "Coming up"
// order rolls forward on its own every year.
//
// To make a new holiday template sort correctly, tag it with one of the
// keys (or aliases) below. A holiday not listed here still shows under its
// category; it just has no date.

export interface Holiday {
  key: string;
  label: string;
  /** Other tags that mean the same holiday. */
  aliases?: string[];
  /** The holiday's date in `year` (local time, midnight). */
  on(year: number): Date;
}

/** The nth `weekday` (0 = Sunday) of `month` (0 = January). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** The last `weekday` of `month`. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

/** Western Easter (anonymous Gregorian algorithm). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** First night of Hanukkah: the evening of 24 Kislev, which always falls
 * between late November and late December. Read from the Hebrew calendar
 * via Intl; mid-December is the fallback if that calendar is unavailable. */
function hanukkah(year: number): Date {
  try {
    const fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" });
    for (let d = new Date(year, 10, 20); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      const parts = fmt.formatToParts(d);
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      if (month === "Kislev" && day === "24") return new Date(d);
    }
  } catch {
    // Fall through to the approximation.
  }
  return new Date(year, 11, 15);
}

const fixed = (month: number, day: number) => (year: number) => new Date(year, month, day);

export const HOLIDAYS: Holiday[] = [
  { key: "new-year", label: "New Year", aliases: ["new-years", "new-years-day"], on: fixed(0, 1) },
  { key: "mlk-day", label: "Martin Luther King Jr. Day", on: (y) => nthWeekday(y, 0, 1, 3) },
  { key: "valentines-day", label: "Valentine's Day", aliases: ["valentines"], on: fixed(1, 14) },
  { key: "presidents-day", label: "Presidents' Day", on: (y) => nthWeekday(y, 1, 1, 3) },
  { key: "st-patricks-day", label: "St. Patrick's Day", on: fixed(2, 17) },
  { key: "easter", label: "Easter", on: easter },
  { key: "mothers-day", label: "Mother's Day", on: (y) => nthWeekday(y, 4, 0, 2) },
  // National Skilled Nursing Care Week starts on Mother's Day.
  { key: "nursing-home-week", label: "Nursing Home Week", aliases: ["nsnhw", "nsncw"], on: (y) => nthWeekday(y, 4, 0, 2) },
  { key: "memorial-day", label: "Memorial Day", on: (y) => lastWeekday(y, 4, 1) },
  { key: "fathers-day", label: "Father's Day", on: (y) => nthWeekday(y, 5, 0, 3) },
  { key: "juneteenth", label: "Juneteenth", on: fixed(5, 19) },
  { key: "4th-of-july", label: "4th of July", aliases: ["independence-day", "july-4th"], on: fixed(6, 4) },
  { key: "labor-day", label: "Labor Day", on: (y) => nthWeekday(y, 8, 1, 1) },
  // National Grandparents Day: the first Sunday after Labor Day.
  {
    key: "grandparents-day",
    label: "Grandparents Day",
    on: (y) => {
      const labor = nthWeekday(y, 8, 1, 1);
      return new Date(y, 8, labor.getDate() + 6);
    },
  },
  { key: "halloween", label: "Halloween", on: fixed(9, 31) },
  { key: "veterans-day", label: "Veterans Day", on: fixed(10, 11) },
  { key: "thanksgiving", label: "Thanksgiving", on: (y) => nthWeekday(y, 10, 4, 4) },
  { key: "hanukkah", label: "Hanukkah", aliases: ["chanukah"], on: hanukkah },
  { key: "christmas", label: "Christmas", on: fixed(11, 25) },
  { key: "kwanzaa", label: "Kwanzaa", on: fixed(11, 26) },
];

const BY_TAG = new Map<string, Holiday>();
for (const h of HOLIDAYS) {
  BY_TAG.set(h.key, h);
  for (const alias of h.aliases ?? []) BY_TAG.set(alias, h);
}

/** The holiday a template is for, from its first matching tag. */
export function holidayForTags(tags: readonly string[]): Holiday | null {
  for (const tag of tags) {
    const h = BY_TAG.get(tag.trim().toLowerCase());
    if (h) return h;
  }
  return null;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The holiday's next date on or after `now`'s day. The day itself still
 * counts as upcoming, so a Halloween graphic stays at the top on the 31st. */
export function nextOccurrence(h: Holiday, now: Date): Date {
  const today = startOfDay(now);
  const thisYear = h.on(today.getFullYear());
  return thisYear >= today ? thisYear : h.on(today.getFullYear() + 1);
}

/** Whole days from `now`'s day to `date`. */
export function daysUntil(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
}
