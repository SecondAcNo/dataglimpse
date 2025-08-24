export const escapeCsvCell = (raw: unknown): string => {
  const s = raw == null ? "" : String(raw);
  // Excel式インジェクション防止
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  // RFC4180: カンマ/改行/ダブルクオートを含む場合クオートし、内部の " を二重化
  return /[",\n]/.test(guarded) ? `"${guarded.replaceAll(`"`, `""`)}"` : guarded;
};

export const buildCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.map(escapeCsvCell).join(",");
  const body = rows.map(r => cols.map(c => escapeCsvCell(r[c])).join(","));
  return [header, ...body].join("\n");
};
