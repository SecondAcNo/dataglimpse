// DBアクセスの最小ユーティリティ（UI非依存）
import { query as sqliteQuery, type RowObject } from "@/lib/sqlite";
import type { BindParams } from "sql.js";

/**
 * 同一ブラウザの IndexedDB 永続DBに対する型安全なクエリ実行
 * - 呼び出し側で <T extends RowObject> を指定して型付けする
 * - 例: runQuery<{ id:number; name:string }>("SELECT id, name FROM users")
 */
export async function runQuery<T extends RowObject = RowObject>(
  sql: string,
  params?: BindParams
): Promise<T[]> {
  return sqliteQuery<T>(sql, params);
}

export type { RowObject };
