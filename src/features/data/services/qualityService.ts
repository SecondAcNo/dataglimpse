/**
 * Service Layer - Data Quality
 * ============================================================================
 * テーブルの品質メトリクス（欠損率・重複率など）を算出するユースケース。
 * - UI/Repo に非依存のビジネスロジック層
 * - 入出力はドメイン型（QualityMetrics / ColumnMeta）で統一
 * - 低レベルの SQL 実行は repo（sqliteRepo）に委譲
 */

import { runQuery } from "@/features/data/repositories/sqliteRepo";
import type { ColumnMeta, QualityMetrics } from "@/features/data/domain/types";

/* ----------------------------------------------------------------------------
 * 内部ヘルパ（非公開）
 * --------------------------------------------------------------------------*/

/**
 * 指定列の欠損率（0..1）を計算する
 * - NULL の件数 / 全件数
 */
async function calcNullRate(table: string, col: string): Promise<number> {
  const [{ nullRate }] = await runQuery<{ nullRate: number }>(
    `SELECT SUM(CASE WHEN "${col}" IS NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS nullRate
       FROM "${table}";`
  );
  return Number(nullRate ?? 0);
}

/**
 * 行全体の単純重複率（0..1）を計算する
 * - すべての列値（TEXT 化＆NULL 置換）を連結し、同一キーの2行目以降を重複とみなす
 */
async function calcDuplicateRateWholeRow(table: string, allCols: string[]): Promise<number> {
  if (allCols.length === 0) return 0;

  const keyExpr = allCols
    .map((c) => `COALESCE(CAST("${c}" AS TEXT), '__NULL__')`)
    .join(" || '|' || ");

  const sql = `
    WITH g AS (
      SELECT ${keyExpr} AS __k__,
             ROW_NUMBER() OVER (PARTITION BY ${keyExpr}) AS rn
        FROM "${table}"
    )
    SELECT SUM(CASE WHEN rn > 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS duplicateRowRate
      FROM g;
  `;

  const [{ duplicateRowRate }] = await runQuery<{ duplicateRowRate: number }>(sql);
  return Number(duplicateRowRate ?? 0);
}

/* ----------------------------------------------------------------------------
 * 公開 API
 * --------------------------------------------------------------------------*/

/**
 * getQuality
 * - 列ごとの欠損率と、行全体の重複率を算出する
 *
 * @param table   対象テーブル名
 * @param columns 事前取得した列メタ（ColumnMeta[]）
 * @returns QualityMetrics
 */
export async function getQuality(table: string, columns: ColumnMeta[]): Promise<QualityMetrics> {
  // 欠損率（列ごと）
  const nullRateByCol: Record<string, number> = {};
  for (const c of columns) {
    nullRateByCol[c.name] = await calcNullRate(table, c.name);
  }

  // 行全体の重複率
  const duplicateRowRate = await calcDuplicateRateWholeRow(
    table,
    columns.map((c) => c.name)
  );

  return { nullRateByCol, duplicateRowRate };
}
