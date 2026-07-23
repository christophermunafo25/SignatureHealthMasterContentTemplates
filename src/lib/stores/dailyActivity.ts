import type { DailyActivityPoint, UsageAction } from "../types";

/** Bucket raw usage events into a continuous run of the last `days` days
 * (zero-filled — the trend chart needs every day present). Shared by both
 * backends so the Insights chart is backend-agnostic. */
export function bucketDailyActivity(
  events: Array<{ action: UsageAction; createdAt: string }>,
  days: number,
): DailyActivityPoint[] {
  const byDay = new Map<string, DailyActivityPoint>();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, opens: 0, downloads: 0 });
  }
  for (const e of events) {
    const point = byDay.get(e.createdAt.slice(0, 10));
    if (!point) continue; // older than the window
    if (e.action === "open") point.opens += 1;
    else point.downloads += 1;
  }
  return [...byDay.values()];
}
