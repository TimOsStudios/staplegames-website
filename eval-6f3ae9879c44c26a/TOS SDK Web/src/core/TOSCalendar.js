/**
 * TOS SDK Web — Date / Calendar helpers.
 *
 * Mirrors `NSCalendar -components:fromDate:toDate:options:` usage on iOS
 * (TOSAnalytics+Time). Two timezones are tracked everywhere:
 *
 *   - **Local** — user's wall clock. Used for `cDailyOpen` etc. so a
 *     user who opens at 11:50pm and again at 12:10am two consecutive
 *     local nights counts as two distinct days.
 *   - **UTC** — universal day. Used for `cDailyOpenUTC` so dashboards
 *     can roll up across timezones without skew.
 *
 * All "days since X" math uses **calendar day deltas**, not raw 86400-sec
 * divisions. Matches iOS calendar math; correct across DST + leap days.
 */

/** YYYY-MM-DD in local timezone. */
export function localDayKey(date = new Date()) {
  const d = date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/** YYYY-MM-DD in UTC. */
export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Calendar-day delta between two Date objects in LOCAL time.
 * Returns a non-negative integer. If `from > to`, returns 0.
 */
export function localDaysBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(),   to.getMonth(),   to.getDate());
  const ms = b - a;
  if (ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

/** Calendar-day delta in UTC. */
export function utcDaysBetween(from, to) {
  if (!from || !to) return 0;
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(),   to.getUTCMonth(),   to.getUTCDate());
  const ms = b - a;
  if (ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

/** Seconds between two Date objects (signed). */
export function secondsBetween(from, to) {
  if (!from || !to) return 0;
  return (to.getTime() - from.getTime()) / 1000;
}

/** Parse an ISO string into a Date, or null. */
export function parseISO(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Round to 2 decimals (matches iOS cLTSeshTime serialization). */
export function round2(n) {
  return Math.round(n * 100) / 100;
}
