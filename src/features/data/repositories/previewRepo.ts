/**
 * Repository Layer - Data Preview
 * ============================================================================
 * テーブルのデータプレビューを取得する責務を持つ低レイヤ。
 * - UI や Service には依存しない
 * - ページネーションに必要な最小情報（rows / page / pageSize / totalRows）を返す
 * - SQL 実行は sqliteRepo の runQuery を利用
 */

import { runQuery, type RowObject } from "@/features/data/repositories/sqliteRepo";
import type { Page } from "@/features/data/domain/types";

/**
 * getPreview
 * 指定テーブルのプレビューを取得する。
 *
 * 注意:
 * - 列順は SQLite のデフォルト（定義順）に従う
 *
 * @param table    テーブル名
 * @param page     0 始まりのページ番号
 * @param pageSize 1 ページあたりの行数
 * @returns Page<RowObject>
 */
export async function getPreview(
  table: string,
  page: number,
  pageSize: number
): Promise<Page<RowObject>> {
  const off = page * pageSize;

  // NOTE: SQL インジェクション対策として識別子のクオートが必要だが、
  // 本プロジェクトではテーブル名は UI 選択由来（既存スキーマのみ）を前提とする。
  const rows = await runQuery<RowObject>(
    `SELECT * FROM "${table}" LIMIT ${pageSize} OFFSET ${off};`
  );

  const [{ totalRows }] = await runQuery<{ totalRows: number }>(
    `SELECT COUNT(*) AS totalRows FROM "${table}";`
  );

  return { rows, page, pageSize, totalRows: Number(totalRows ?? 0) };
}

export type { RowObject };
