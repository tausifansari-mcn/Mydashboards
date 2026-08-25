// Relative performance banding, not a fixed score threshold: rank every row by score
// (highest first) and split into 4 equal-ish groups — Q1 = top performers/periods, Q4 = bottom.
// Row order is preserved (chronological for date/week-wise data) — only the label is
// rank-derived, not the position in the returned array.
export function withQuartile<T>(rows: T[], scoreOf: (r: T) => number): (T & { quartile: string })[] {
  const n = rows.length;
  const ranked = rows
    .map((r, i) => ({ i, score: scoreOf(r) }))
    .sort((a, b) => b.score - a.score);
  const quartileByIndex = new Map<number, string>();
  ranked.forEach((entry, rank) => {
    const bucket = n > 0 ? Math.min(3, Math.floor((rank / n) * 4)) : 0;
    quartileByIndex.set(entry.i, `Q${bucket + 1}`);
  });
  return rows.map((r, i) => ({ ...r, quartile: quartileByIndex.get(i)! }));
}
