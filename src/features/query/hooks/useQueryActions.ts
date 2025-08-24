"use client";

import * as React from "react";
import { exportCsv } from "@/features/query/services/csv";

/** useQueryActions に渡す引数型 */
type UseQueryActionsParams<Row extends Record<string, unknown>> = {
  sql: string;                        // 現在のSQL文字列
  rows: Row[];                        // 実行結果の行データ
  cols: string[];                     // 実行結果のカラム名
  setSql: (s: string) => void;        // SQLをエディタに反映する関数
  onRun: () => Promise<void> | void;  // SQLを実行する関数
};

/**
 * useQueryActions
 * -----------------------------------------------------------------------------
 * クエリに関する共通アクションをまとめたカスタムフック
 * - SQLコピー
 * - CSVエクスポート
 * - 履歴からの反映
 * - 履歴からの即時実行
 */
export function useQueryActions<Row extends Record<string, unknown>>(
  { sql, rows, cols, setSql, onRun }: UseQueryActionsParams<Row>
) {
  /** SQL文字列をクリップボードにコピー */
  const onCopySql = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sql);
    } catch {
      // Clipboard API が失敗しても無視
    }
  }, [sql]);

  /** 実行結果を CSV としてダウンロード */
  const onExportCsv = React.useCallback(() => {
    exportCsv("query_results.csv", rows, cols);
  }, [rows, cols]);

  /** 履歴のSQLをエディタに反映 */
  const onHistoryUse = React.useCallback((s: string) => setSql(s), [setSql]);

  /** 履歴のSQLをエディタに反映し、即時実行 */
  const onHistoryRun = React.useCallback(async (s: string) => {
    setSql(s);
    await onRun();
  }, [setSql, onRun]);

  /** View 側に返却するアクション群 */
  return { onCopySql, onExportCsv, onHistoryUse, onHistoryRun };
}
