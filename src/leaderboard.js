// Local leaderboard rules (Ticket-04 section 3). Pure functions, shared by the server, the web client and the tests.
export const TOP_N = 10;
// 3-12 characters. [A-Za-z0-9_] as required, plus Vietnamese (any Unicode letter/digit) as the optional bonus.
export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;

export class LeaderboardError extends Error {}

export function validateName(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new LeaderboardError('name must be 3-12 characters: letters, digits or _');
  }
  return name;
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T15:30:00+07:00. */
export function isoWithOffset(date = new Date()) {
  const off = -date.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  validateName(name);
  if (!Number.isInteger(score) || score < 0) throw new LeaderboardError('score must be a non-negative integer');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new LeaderboardError('nights_won must be 0-3');
  if (!Number.isInteger(seed)) throw new LeaderboardError('seed must be an integer');
  return { name, score, nights_won, achieved_at: isoWithOffset(now), seed };
}

/** Highest score first; equal scores: whoever achieved it earlier is on top (then insertion order). */
export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i, t: Date.parse(e.achieved_at) }))
    .sort((a, b) => b.e.score - a.e.score || a.t - b.t || a.i - b.i)
    .map((x) => x.e);
}

export function addEntry(entries, entry) {
  return sortEntries([...entries, entry]).slice(0, TOP_N);
}

/** Validates data read from disk; throws if the shape is wrong. */
export function parseStored(doc) {
  if (!doc || !Array.isArray(doc.entries)) throw new LeaderboardError('leaderboard file must be {"entries": [...]}');
  for (const e of doc.entries) {
    validateName(e.name);
    if (!Number.isInteger(e.score) || !Number.isInteger(e.nights_won) || typeof e.achieved_at !== 'string' || Number.isNaN(Date.parse(e.achieved_at)) || !Number.isInteger(e.seed)) {
      throw new LeaderboardError('bad leaderboard entry');
    }
  }
  return sortEntries(doc.entries).slice(0, TOP_N);
}
