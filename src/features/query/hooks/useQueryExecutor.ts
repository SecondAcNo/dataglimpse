"use client";

import * as React from "react";
import { exec } from "@/lib/sqlite";
import { trimTrailingSemicolons, isSelectLike } from "@/features/query/utils/sql";
import { getColumnsOnly, fetchCount, fetchPage } from "@/features/query/services/pagedSelect";

/** useQueryExecutor に渡す引数型 */
type Params<Row extends Record<string, unknown>> = {
  sql: string;                           // 実行対象のSQL
  rowsPerPage: number;                   // 1ページの表示行数
  onFormat: () => void;                  // 実行前にSQLを整形する処理

  setPage: (n: number) => void;          // ページ番号更新
  setCols: (cols: string[]) => void;     // カラム名更新
  setRows: (rows: Row[]) => void;        // データ行更新
  setBaseSql: (s: string) => void;       // ページング用の基準SQL更新
  setTotalRows: (n: number) => void;     // 全件数更新
  setInfo: (s: string | null) => void;   // 情報メッセージ更新

  /** Container 側で管理しているローディング＆エラー */
  setLoading: (b: boolean) => void;
  setError: (s: string | null) => void;

  /** DDL実行後にスキーマを再取得 */
  refreshSchema: () => Promise<void>;

  /** 履歴追加（実行成功時に記録） */
  addHistory: (sql: string) => void;
};

/**
 * useQueryExecutor
 * -----------------------------------------------------------------------------
 * SQL の実行処理を担うカスタムフック。
 * - SELECT 系 → ページング付きで件数・1ページ目を取得
 * - それ以外（DDL/DML）→ exec() で実行し、スキーマを更新
 * - 実行履歴への追加も担当
 */
export function useQueryExecutor<Row extends Record<string, unknown>>(p: Params<Row>) {
  const onRun = React.useCallback(async () => {
    const {
      sql, rowsPerPage, onFormat,
      setPage, setCols, setRows, setBaseSql, setTotalRows, setInfo,
      setLoading, setError, refreshSchema, addHistory,
    } = p;

    // 実行開始 → ローディングON・メッセージリセット
    setLoading(true); 
    setError(null); 
    setInfo(null);

    try {
      // 入力SQLをトリム（末尾セミコロンも除去）
      const original = sql.trim();
      onFormat(); // 実行前にSQL整形
      const s = trimTrailingSemicolons(original);

      if (isSelectLike(s)) {
        /** SELECT系クエリの場合 */
        setPage(0); // 1ページ目に戻す

        // カラム名だけ先に取得
        const colsOnly = await getColumnsOnly(s);
        setCols(colsOnly);

        // 件数 & ページ先頭のデータを並列取得
        const [cnt, pageRows] = await Promise.all([
          fetchCount(s),
          fetchPage<Row>(s, 0, rowsPerPage, colsOnly),
        ]);

        // 結果をステートに反映
        setBaseSql(s);
        setTotalRows(cnt);
        setRows(pageRows);
        setInfo(`全 ${cnt.toLocaleString()} 行（ページ 1 / ${Math.max(1, Math.ceil(cnt / rowsPerPage))}）`);
      } else {
        /** SELECT以外（DDL/DML）の場合 */
        await exec(s); // 実行のみ
        setCols([]); 
        setRows([]); 
        setTotalRows(0); 
        setBaseSql("");
        setInfo("実行しました。");

        // テーブル定義変更の可能性があるためスキーマ更新
        await refreshSchema();
      }

      // 履歴に追加
      addHistory(s);
    } catch (e) {
      // エラーを文字列化して表示
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      // 終了時はローディング解除
      setLoading(false);
    }
  }, [p]);

  return { onRun };
}
