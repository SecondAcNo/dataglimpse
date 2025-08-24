"use client";

/** 重複列ヘッダを column, column_2, ... のようにユニーク化する */
export function dedupeColumns(raw: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((name, idx) => {
    const base = (name ?? `column_${idx + 1}`).toString();
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

/** 末尾のセミコロンをトリム（複数や空白も考慮） */
export function trimTrailingSemicolons(s: string) {
  return s.replace(/;+\s*$/g, "");
}

/** SELECT 系（WITH/SELECTで開始）かどうか判定（コメント・先頭の括弧を考慮） */
export function isSelectLike(sql: string) {
  const s = sql
    .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, "") // block + line comments
    .trim()
    .replace(/^\(+/, "")
    .trim();
  return /^with\b/i.test(s) || /^select\b/i.test(s);
}
