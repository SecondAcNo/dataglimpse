/**
 * Repository Layer - Column Statistics
 * ============================================================================
 * 列ごとの統計情報を取得する責務を持つ低レイヤ。
 * - distinct 件数 / サンプル値を返す
 * - SQL 実行は sqliteRepo の runQuery に委譲
 * - UI や Service には依存しない
 */

import { runQuery } from "@/features/data/repositories/sqliteRepo";

/**
 * getDistinctCount
 * 指定列の distinct 値の件数を返す
 *
 * @param table  テーブル名
 * @param column 列名
 * @returns distinct の件数
 */
export async function getDistinctCount(table: string, column: string): Promise<number> {
  const [{ d }] = await runQuery<{ d: number }>(
    `SELECT COUNT(DISTINCT "${column}") AS d FROM "${table}";`
  );
  return Number(d ?? 0);
}

/**
 * getSamples
 * 指定列のサンプル値を最大 limit 件返す
 *
 * 注意:
 * - ORDER BY を指定していないため、返る順序は SQLite の実装依存
 * - UI では「代表値例」として軽量に利用する前提
 *
 * @param table  テーブル名
 * @param column 列名
 * @param limit  最大件数（デフォルト: 5）
 * @returns サンプル値の配列
 */
export async function getSamples(
  table: string,
  column: string,
  limit = 5
): Promise<unknown[]> {
  const rows = await runQuery<Record<string, unknown>>(
    `SELECT "${column}" AS v FROM "${table}" LIMIT ${limit};`
  );
  return rows.map(r => r.v);
}
