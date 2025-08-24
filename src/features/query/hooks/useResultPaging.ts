"use client";

import * as React from "react";
import { fetchPage } from "@/features/query/services/pagedSelect";

/** useResultPaging に渡す引数型 */
type Params<Row extends Record<string, unknown>> = {
  /** ページング対象の基底SQL（SELECT ... 文のみ） */
  baseSql: string;
  /** 表示する列名（順序保持） */
  cols: string[];
  /** 総件数（ページ数計算に利用） */
  totalRows: number;
  /** ページ取得後に行データを反映する setter */
  setRows: (rows: Row[]) => void;
  /** 情報メッセージの setter */
  setInfo: (s: string) => void;
  /** ローディング制御用の setter */
  setLoading: (b: boolean) => void;
};

/**
 * useResultPaging
 * -----------------------------------------------------------------------------
 * クエリ結果テーブルの「ページ番号 / 1ページあたり件数」を管理するフック。
 * - ページ切り替え時に fetchPage() を呼び、結果を反映
 * - 件数変更時にも 1ページ目を再取得
 * - 情報テキスト (例: "全1000行 (ページ1/50)") を自動更新
 */
export function useResultPaging<Row extends Record<string, unknown>>(
  { baseSql, cols, totalRows, setRows, setInfo, setLoading }: Params<Row>
) {
  /** 現在のページ番号（0始まり） */
  const [page, setPage] = React.useState<number>(0);

  /** 1ページあたりの表示件数 */
  const [rowsPerPage, setRowsPerPage] = React.useState<number>(20);

  /**
   * ページ切り替え時のハンドラ
   * - page を更新
   * - fetchPage() で対象ページを取得して setRows へ反映
   * - setInfo でページ情報を更新
   */
  const handlePageChange = React.useCallback(async (_: unknown, p: number) => {
    setPage(p);
    if (!baseSql || cols.length === 0) return;
    setLoading(true);
    try {
      const pageRows = await fetchPage<Row>(baseSql, p, rowsPerPage, cols);
      setRows(pageRows);
      setInfo(
        `全 ${totalRows.toLocaleString()} 行（ページ ${p + 1} / ${Math.max(1, Math.ceil(totalRows / rowsPerPage))}）`
      );
    } finally {
      setLoading(false);
    }
  }, [baseSql, cols, rowsPerPage, totalRows, setLoading, setRows, setInfo]);

  /**
   * 1ページあたり件数の変更時ハンドラ
   * - rowsPerPage を更新
   * - ページ番号を 0 にリセット
   * - fetchPage() で1ページ目を再取得
   */
  const handleRowsPerPageChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value, 10);
    setRowsPerPage(n);
    setPage(0);
    if (!baseSql || cols.length === 0) return;
    setLoading(true);
    try {
      const pageRows = await fetchPage<Row>(baseSql, 0, n, cols);
      setRows(pageRows);
      setInfo(
        `全 ${totalRows.toLocaleString()} 行（ページ 1 / ${Math.max(1, Math.ceil(totalRows / n))}）`
      );
    } finally {
      setLoading(false);
    }
  }, [baseSql, cols, totalRows, setLoading, setRows, setInfo]);

  /** 呼び出し元に返却する state とハンドラ */
  return {
    page,                 // 現在のページ番号
    rowsPerPage,          // 1ページあたり件数
    setPage,              // ページ番号 setter（直接更新用）
    setRowsPerPage,       // 件数 setter（直接更新用）
    handlePageChange,     // ページ切り替えハンドラ
    handleRowsPerPageChange, // 件数切替ハンドラ
  };
}
