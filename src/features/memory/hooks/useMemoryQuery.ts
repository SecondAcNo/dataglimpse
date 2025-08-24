"use client";

import { useCallback, useMemo, useState } from "react";
import { runQuery, type RowData } from "@/lib/duck";
import type { ExecState, Mode } from "@/features/memory/types/memory";

/** フックの返却型 */
export type UseMemoryQueryReturn = {
  // 状態: UIやロジックが直接参照する値
  columns: string[];       // 現在のSQL/テーブルの列名一覧
  rows: RowData[];         // 現在ページに表示中の行データ
  mode: Mode;              // "adhoc"（即席表示） or "query"（SQL実行）
  baseSql: string;         // ページングや再実行に使う元SQL
  totalCount: number;      // 総件数（DB側で算出 or クライアント配列長）
  loading: boolean;        // 実行中フラグ
  page: number;            // 現在のページ番号（0-based）
  rowsPerPage: number;     // 1ページあたりの件数

  // 導出: 状態から計算された派生値
  pagedRows: RowData[];    // クライアント側でsliceした行（adhoc時のみ利用）
  paginationCount: number; // ページネーションの対象件数

  // アクション: 外部UIから呼ばれる操作関数
  execute: (args: { ready: boolean; hasTable: boolean; sql: string }) => Promise<void>;
  doPreview: (args: { hasTable: boolean; currentTable: string }) => Promise<void>;
  doCount: (args: { hasTable: boolean; currentTable: string }) => Promise<void>;
  doTableInfo: (args: { hasTable: boolean; currentTable: string }) => Promise<void>;
  handlePageChange: (p: number) => Promise<void>;
  handleRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => Promise<void>;
};

/**
 * useMemoryQuery
 * ============================================================================
 * メモリDB（DuckDB-WASM）上での SQL 実行と結果管理を統合したカスタムフック。
 *
 * 提供機能:
 *  - 任意SQLの実行（件数カウント + ページング取得を内部で処理）
 *  - プリセット操作（プレビュー / 件数カウント / カラム情報取得）
 *  - ページングと1ページあたり行数の変更処理
 */
export default function useMemoryQuery(setExec: React.Dispatch<React.SetStateAction<ExecState>>): UseMemoryQueryReturn {
  // ---- 状態管理 ----
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [mode, setMode] = useState<Mode>("adhoc");
  const [baseSql, setBaseSql] = useState<string>("");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);

  // ---- 内部ユーティリティ ----
  /** SQLを0件実行し、列情報だけを取得 */
  const getColumnsOnly = useCallback(async (innerSql: string) => {
    const { columns: cols } = await runQuery(`SELECT * FROM (${innerSql}) t LIMIT 0`);
    return cols;
  }, []);

  /** 総件数をCOUNT(*)で取得 */
  const fetchCount = useCallback(async (innerSql: string) => {
    const { rows } = await runQuery(`SELECT COUNT(*) AS cnt FROM (${innerSql}) t`);
    return Number(rows[0]?.["cnt"] ?? 0);
  }, []);

  /** 指定ページをDB側LIMIT/OFFSETで取得 */
  const fetchPage = useCallback(async (innerSql: string, p: number, pageSize: number) => {
    const off = p * pageSize;
    return await runQuery(`SELECT * FROM (${innerSql}) t LIMIT ${pageSize} OFFSET ${off}`);
  }, []);

  // ---- SQL 実行処理 ----
  const execute = useCallback<UseMemoryQueryReturn["execute"]>(async ({ ready, hasTable, sql }) => {
    if (!ready) return;

    // テーブル依存系SQLかを軽く判定（テーブル未選択時の保護）
    const needsTable = /\b(from|join|update|insert|delete|merge|pragma|describe)\b/i.test(sql);
    if (!hasTable && needsTable) {
      setExec({ status: "テーブル未選択です。先にテーブルを選んでください。", execMs: null });
      return;
    }

    setExec({ status: "クエリ実行中…", execMs: null });
    setLoading(true);
    setMode("query");
    setPage(0);

    const t0 = performance.now();
    try {
      // 列情報、件数、1ページ目を並行取得
      const cols = await getColumnsOnly(sql);
      setColumns(cols);

      const [cnt, page1] = await Promise.all([fetchCount(sql), fetchPage(sql, 0, rowsPerPage)]);
      setBaseSql(sql);
      setTotalCount(cnt);
      setRows(page1.rows);

      const t1 = performance.now();
      setExec({
        status: `成功：全 ${cnt.toLocaleString()} 行（表示はページ 1/${Math.max(1, Math.ceil(cnt / rowsPerPage))}）`,
        execMs: Math.round(t1 - t0),
      });
    } catch (e: unknown) {
      // エラー時はadhocモードに戻してクリア
      const t1 = performance.now();
      const msg = e instanceof Error ? e.message : String(e);
      setColumns([]);
      setRows([]);
      setTotalCount(0);
      setBaseSql("");
      setMode("adhoc");
      setExec({ status: `エラー：${msg}`, execMs: Math.round(t1 - t0) });
    } finally {
      setLoading(false);
    }
  }, [fetchCount, fetchPage, getColumnsOnly, rowsPerPage, setExec]);

  // ---- プリセット操作群 ----
  /** 行数だけを取得（SELECT COUNT(*)） */
  const doCount = useCallback<UseMemoryQueryReturn["doCount"]>(async ({ hasTable, currentTable }) => {
    if (!hasTable) {
      setExec({ status: "テーブル未選択です。", execMs: null });
      return;
    }
    setExec({ status: "行数カウント中…", execMs: null });
    const t0 = performance.now();
    const { columns: cols, rows: data } = await runQuery(
      `SELECT COUNT(*) AS rows FROM "${currentTable.replace(/"/g, '""')}"`
    );
    const t1 = performance.now();
    setColumns(cols);
    setRows(data);
    setPage(0);
    setTotalCount(data.length);
    setMode("adhoc");
    setBaseSql("");
    setExec({ status: "行数カウント完了", execMs: Math.round(t1 - t0) });
  }, [setExec]);

  /** SELECT * FROM table LIMIT… によるプレビュー */
  const doPreview = useCallback<UseMemoryQueryReturn["doPreview"]>(async ({ hasTable, currentTable }) => {
    if (!hasTable) {
      setExec({ status: "テーブル未選択です。", execMs: null });
      return;
    }
    const base = `SELECT * FROM "${currentTable.replace(/"/g, '""')}"`;
    setExec({ status: "プレビュー取得中…", execMs: null });
    setLoading(true);
    setMode("query");
    setPage(0);
    const t0 = performance.now();
    try {
      const cols = await getColumnsOnly(base);
      const [cnt, page1] = await Promise.all([fetchCount(base), fetchPage(base, 0, rowsPerPage)]);
      setColumns(cols);
      setBaseSql(base);
      setTotalCount(cnt);
      setRows(page1.rows);
      const t1 = performance.now();
      setExec({ status: "プレビュー取得完了", execMs: Math.round(t1 - t0) });
    } finally {
      setLoading(false);
    }
  }, [fetchCount, fetchPage, getColumnsOnly, rowsPerPage, setExec]);

  /** PRAGMA table_info によるカラム定義情報取得 */
  const doTableInfo = useCallback<UseMemoryQueryReturn["doTableInfo"]>(async ({ hasTable, currentTable }) => {
    if (!hasTable) {
      setExec({ status: "テーブル未選択です。", execMs: null });
      return;
    }
    setExec({ status: "カラム情報取得中…", execMs: null });
    const t0 = performance.now();
    const { columns: cols, rows: data } = await runQuery(
      currentTable ? `PRAGMA table_info("${currentTable.replace(/"/g, '""')}")` : "SELECT 1"
    );
    const t1 = performance.now();
    setColumns(cols);
    setRows(data);
    setPage(0);
    setTotalCount(data.length);
    setMode("adhoc");
    setBaseSql("");
    setExec({ status: "カラム情報取得完了", execMs: Math.round(t1 - t0) });
  }, [setExec]);

  // ---- ページング操作 ----
  /** ページ番号変更（DB側再クエリ or adhoc slice） */
  const handlePageChange = useCallback<UseMemoryQueryReturn["handlePageChange"]>(async (p) => {
    setPage(p);
    if (mode !== "query" || !baseSql) return;
    setLoading(true);
    try {
      const { rows: pageRows } = await fetchPage(baseSql, p, rowsPerPage);
      setRows(pageRows);
      setExec((prev) => ({ ...prev, status: `ページ ${p + 1} を表示` }));
    } finally {
      setLoading(false);
    }
  }, [baseSql, fetchPage, mode, rowsPerPage, setExec]);

  /** ページサイズ変更（再クエリ or adhoc slice再計算） */
  const handleRowsPerPageChange = useCallback<UseMemoryQueryReturn["handleRowsPerPageChange"]>(async (e) => {
    const n = Number(String(e.target.value));
    setRowsPerPage(n);
    setPage(0);
    if (mode !== "query" || !baseSql) return;
    setLoading(true);
    try {
      const { rows: pageRows } = await fetchPage(baseSql, 0, n);
      setRows(pageRows);
      setExec((prev) => ({ ...prev, status: `ページサイズを ${n} に変更` }));
    } finally {
      setLoading(false);
    }
  }, [baseSql, fetchPage, mode, setExec]);

  // ---- クライアント側ページング（adhoc用）----
  const pagedRows = useMemo(() => {
    if (mode === "query") return rows;
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return rows.slice(start, end);
  }, [mode, rows, page, rowsPerPage]);

  const paginationCount = mode === "query" ? totalCount : rows.length;

  return {
    columns,
    rows,
    mode,
    baseSql,
    totalCount,
    loading,
    page,
    rowsPerPage,
    pagedRows,
    paginationCount,
    execute,
    doPreview,
    doCount,
    doTableInfo,
    handlePageChange,
    handleRowsPerPageChange,
  };
}
