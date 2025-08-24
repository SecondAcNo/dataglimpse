export type Affinity = "INTEGER" | "REAL" | "NUMERIC" | "TEXT";

/** SQL識別子の安全なクォート */
export function safeIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** SQLiteの型文字列 → 4種のアフィニティに正規化 */
export function mapAffinity(type: string | null | undefined): Affinity {
  const t = (type ?? "").toUpperCase();
  if (t.includes("INT")) return "INTEGER";
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB")) return "REAL";
  if (t.includes("NUM") || t.includes("DATE") || t.includes("TIME")) return "NUMERIC";
  return "TEXT";
}

/** 単純な単数化（s終端のみ除去） */
export function singularize(s: string): string {
  return s.endsWith("s") ? s.slice(0, -1) : s;
}
