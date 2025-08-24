/**
 * affinity.ts
 * -----------------------------------------------------------------------------
 * SQLite の型親和性（Type Affinity）と、その簡易マッピング関数を一元管理する。
 * ここを単一の「真実の所在（Single Source of Truth）」とし、他モジュールから参照する。
 *
 * - INTEGER: 整数系（例: INT, BIGINT）
 * - REAL:    浮動小数点系（例: REAL, DOUBLE, FLOAT）
 * - NUMERIC: 数値/日付/時間など（例: NUMERIC, DATE, DATETIME, TIME）
 * - TEXT:    それ以外の文字列系
 */

export type Affinity = "INTEGER" | "REAL" | "NUMERIC" | "TEXT";

/**
 * 宣言型（任意文字列）から SQLite の型親和性 (Affinity) を簡易判定する。
 *
 * ルール（優先順）:
 *  1) "INT"     を含む → "INTEGER"
 *  2) "REAL" | "FLOA" | "DOUB" を含む → "REAL"
 *  3) "NUM" | "DATE" | "TIME"  を含む → "NUMERIC"
 *  4) それ以外 → "TEXT"
 *
 * @param type 任意の型宣言文字列（null/undefined 可）
 * @returns Affinity
 *
 * @example
 * mapAffinity("int")         // "INTEGER"
 * mapAffinity("double")      // "REAL"
 * mapAffinity("datetime")    // "NUMERIC"
 * mapAffinity("varchar(32)") // "TEXT"
 */
export function mapAffinity(type: string | null | undefined): Affinity {
  const t = (type ?? "").toUpperCase();
  if (t.includes("INT")) return "INTEGER";
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB")) return "REAL";
  if (t.includes("NUM") || t.includes("DATE") || t.includes("TIME")) return "NUMERIC";
  return "TEXT";
}