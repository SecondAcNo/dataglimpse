/**
 * Repository Layer - Table Metadata
 * ============================================================================
 * 本モジュールは SQLite 上に存在するテーブルのメタデータを取得する責務を持つ。
 * - UI（React Component）や Service 層に依存しない純粋な DB アクセスロジック
 * - `runQuery` のラッパとして必要な SQL / PRAGMA を隠蔽し、
 *   呼び出し側には型付きのドメインモデルを返す
 *
 * 提供機能:
 * - listTables   : テーブル一覧の取得
 * - getBasic     : 行数・列数を含むテーブル基本情報の取得
 * - getColumns   : 列メタ情報の取得（型、制約など）
 *
 * 備考:
 * - すべて非同期関数として実装され、呼び出しは `await` が必須
 * - sqlite_schema や PRAGMA 系の SQL は SQLite 固有仕様
 * - DB アクセス時に例外が発生した場合は呼び出し側でハンドリングすること
 */

import { runQuery, type RowObject } from "@/features/data/repositories/sqliteRepo";
import type { TableBasic, ColumnMeta } from "@/features/data/domain/types";

/* ============================================================================
 * テーブル一覧
 * ==========================================================================*/

/**
 * DB 内のユーザ定義テーブル名を列挙する
 * - sqlite_schema を参照し、内部テーブル (sqlite_*) は除外
 * - ソート順はアルファベット順
 *
 * @returns string[] - テーブル名の配列
 */
export async function listTables(): Promise<string[]> {
  const rows = await runQuery<{ name: string }>(
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  return rows.map((r) => r.name);
}

/* ============================================================================
 * テーブル基本情報
 * ==========================================================================*/

/**
 * 指定テーブルの基本情報を取得する
 * - 総行数と列数を含む最低限のメタデータ
 * - サイズや更新日時などはここでは扱わない（拡張時は TableBasic に追加）
 *
 * @param table - テーブル名
 * @returns TableBasic - 行数・列数などの基本情報
 */
export async function getBasic(table: string): Promise<TableBasic> {
  // 行数カウント
  const [{ rowCount }] = await runQuery<{ rowCount: number }>(
    `SELECT COUNT(*) AS rowCount FROM "${table}";`
  );

  // 列メタ（列数算出用）
  const cols = await runQuery<{
    cid: number; name: string; type: string; notnull: 0 | 1; pk: 0 | 1;
  }>(`PRAGMA table_info("${table}");`);

  return {
    name: table,
    rowCount: Number(rowCount ?? 0),
    colCount: cols?.length ?? 0,
  };
}

/* ============================================================================
 * 列メタ情報
 * ==========================================================================*/

/**
 * 指定テーブルの列メタ情報を取得する
 * - 各列の名前、データ型、NULL可否、主キー/ユニーク制約を返す
 * - ユニーク判定は PRAGMA index_list / index_info を利用して推定
 *
 * @param table - テーブル名
 * @returns ColumnMeta[] - 列ごとのメタ情報配列
 */
export async function getColumns(table: string): Promise<ColumnMeta[]> {
  // PRAGMA table_info で列情報を取得
  type TableInfo = { cid: number; name: string; type: string; notnull: 0 | 1; pk: 0 | 1 };
  const rows = await runQuery<TableInfo>(`PRAGMA table_info("${table}");`);

  // PRAGMA index_list でユニークインデックス候補を列挙
  type IndexList = { name: string; unique: 0 | 1 };
  const idxList = await runQuery<IndexList>(`PRAGMA index_list("${table}");`);

  const uniqCandidates = new Set<string>();
  for (const idx of idxList) {
    if (idx.unique === 1) {
      // ユニークインデックスに含まれる列を収集
      type IndexInfo = { name: string };
      const cols = await runQuery<IndexInfo>(`PRAGMA index_info("${idx.name}");`);
      cols.forEach((c) => uniqCandidates.add(c.name));
    }
  }

  // ColumnMeta 型に変換して返却
  return rows.map(
    (r) =>
      ({
        name: String(r.name),
        dataType: String(r.type ?? ""),
        nullable: r.notnull === 0,
        isPrimaryKey: r.pk === 1,
        isUnique: uniqCandidates.has(String(r.name)),
      }) as ColumnMeta
  );
}

/* ============================================================================
 * 型の再エクスポート
 * ==========================================================================*/

// RowObject を再公開することで呼び出し側が sqliteRepo に依存しなくて済む
export type { RowObject };
