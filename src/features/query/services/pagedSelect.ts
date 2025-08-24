"use client";

import { getDb, query } from "@/lib/sqlite";
import { dedupeColumns } from "@/features/query/utils/sql";

/**
 * SELECT の列名だけ取得して返す
 * - 実際のデータは取得せず、LIMIT 0 で列メタデータのみ得る
 * - 列名が重複する場合は dedupeColumns() でユニーク化
 */
export async function getColumnsOnly(innerSql: string): Promise<string[]> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM (${innerSql}) t LIMIT 0`);
  try {
    const raw = stmt.getColumnNames() as string[];
    return dedupeColumns(raw);
  } finally {
    stmt.free(); // ステートメントは必ず解放
  }
}

/**
 * SELECT 全体の件数を取得する
 * - 与えられたクエリをサブクエリにラップし COUNT(*) を実行
 */
export async function fetchCount(innerSql: string): Promise<number> {
  const [{ cnt }] = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM (${innerSql}) t`
  );
  return Number(cnt ?? 0);
}

/**
 * 指定ページのデータを取得する
 * - LIMIT / OFFSET を利用して部分的に取得
 * - colNames に基づき {列名: 値} のオブジェクトに変換して返す
 */
export async function fetchPage<Row extends Record<string, unknown>>(
  innerSql: string,
  page: number,
  pageSize: number,
  colNames: string[],
): Promise<Row[]> {
  const off = page * pageSize; // OFFSET の計算
  const db = await getDb();
  const stmt = db.prepare(
    `SELECT * FROM (${innerSql}) t LIMIT ${pageSize} OFFSET ${off}`
  );
  const out: Row[] = [];
  try {
    // SQLite ステートメントを1行ずつ進めて取得
    while (stmt.step()) {
      const vals = stmt.get() as unknown[];
      const o = {} as Row;
      for (let i = 0; i < colNames.length; i++) {
        (o as Record<string, unknown>)[colNames[i]] = vals[i];
      }
      out.push(o);
    }
  } finally {
    stmt.free(); // 必ず解放
  }
  return out;
}
