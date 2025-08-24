"use client";

import { getDb, listTables, query } from "@/lib/sqlite";

/** 単一テーブルのスキーマ情報型 */
export type TableSchemaEntry = { 
  table: string;     // テーブル名
  columns: string[]; // カラム名リスト
};

/**
 * fetchSchema
 * -----------------------------------------------------------------------------
 * DB接続を初期化し、テーブル一覧と各テーブルのカラム情報を取得する。
 * - getDb(): DBインスタンスを準備（初期化も兼ねる）
 * - listTables(): DB内のテーブル名一覧を取得
 * - PRAGMA table_info(): 各テーブルのカラム定義を取得
 *
 * @returns { hasTables, schema }
 *   - hasTables: テーブルが存在するかどうか
 *   - schema:   各テーブルごとのカラム一覧
 */
export async function fetchSchema(): Promise<{
  hasTables: boolean;
  schema: TableSchemaEntry[];
}> {
  // DB初期化（未初期化なら接続を確立）
  await getDb();

  // テーブル一覧を取得
  const tables = await listTables();
  const hasTables = tables.length > 0;

  // 各テーブルごとにカラム一覧を取得
  const schema: TableSchemaEntry[] = [];
  for (const t of tables) {
    const colsInfo = await query<{ name: string }>(
      // ダブルクオートをエスケープしつつ PRAGMA でカラム情報取得
      `PRAGMA table_info("${t.replace(/"/g, '""')}")`
    );
    schema.push({ 
      table: t, 
      columns: colsInfo.map(c => c.name) 
    });
  }

  return { hasTables, schema };
}
