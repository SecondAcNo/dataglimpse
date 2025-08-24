"use client";

import { useState } from "react";
import useDuckInit from "@/features/memory/hooks/useDuckInit";
import useDuckImport from "@/features/memory/hooks/useDuckImport";
import useParquetExport from "@/features/memory/hooks/useParquetExport";
import useMemoryQuery from "@/features/memory/hooks/useMemoryQuery";
import useTableVirtualizer from "@/features/memory/hooks/useTableVirtualizer";
import useCsvExport from "@/features/memory/hooks/useCsvExport";

import MemoryPageView from "@/features/memory/views/MemoryPageView";
import type { ExecState } from "@/features/memory/types/memory";

/**
 * MemoryPageContainer
 * =============================================================================
 * Presentation-Controller コンポーネント。
 *
 * 責務:
 * - 各種 hooks を初期化して、状態管理とユースケース呼び出しを一元化する。
 * - 実際の UI レンダリングは MemoryPageView に委譲し、Container は状態配線のみ行う。
 *
 * 構成要素:
 * - useDuckInit:   DuckDB の初期化・テーブル管理
 * - useDuckImport: ファイル取り込み (CSV/Parquet)
 * - useParquetExport: Parquet エクスポート
 * - useCsvExport:  CSV エクスポート
 * - useMemoryQuery: SQL 実行、プレビュー、ページング
 * - useTableVirtualizer: 仮想化による効率的なテーブル描画
 */
export default function MemoryPageContainer() {
  // --- SQL入力状態 & 実行結果ステータス ---------------------------------------
  const [sql, setSql] = useState<string>("SELECT 1");
  const [{ status, execMs }, setExec] = useState<ExecState>({
    status: "準備中…", // 初期表示用メッセージ
    execMs: null,       // 実行時間（ms）
  });

  // --- DuckDB 初期化 & テーブル・スキーマ管理 -------------------------------
  const {
    ready,            // DuckDB 初期化完了フラグ
    tables,           // DB 内テーブル一覧
    currentTable,     // 現在選択中のテーブル
    schemaDict,       // { tableName: [col1, col2, ...] }
    hasTable,         // テーブル存在有無
    setCurrentTable,  // 選択テーブル切替
    reloadTables,     // 再読み込み
  } = useDuckInit(setExec);

  // --- ファイル取り込み (CSV/Parquet) ----------------------------------------
  const { onDropFile } = useDuckImport({
    ready,
    setExec,
    reloadTables,
    setSql,
  });

  // --- Parquet エクスポート ---------------------------------------------------
  const {
    parquetBusy,        // 実行中フラグ
    parquetProgress,    // 進捗率
    exportSource,       // エクスポート対象（SQL or テーブル）
    setExportSource,    // 切替 setter
    parquetCodec,       // 圧縮方式 (e.g., "zstd", "gzip")
    setParquetCodec,
    doParquet,          // 実行関数
  } = useParquetExport(setExec);

  // --- CSV エクスポート -------------------------------------------------------
  const { csvBusy, csvProgress, doCsv } = useCsvExport(setExec);

  // --- SQL 実行・ページング ---------------------------------------------------
  const {
    columns,                 // 結果カラム名
    pagedRows,               // ページ内の行データ
    paginationCount,         // 総件数
    rowsPerPage,             // 1ページ行数
    page,                    // 現在のページ番号
    loading,                 // 実行中フラグ
    execute,                 // SQL実行
    doPreview,               // SELECT * LIMIT 1000 相当
    doCount,                 // 件数確認
    doTableInfo,             // メタ情報確認
    handlePageChange,        // ページ切替
    handleRowsPerPageChange, // 行数切替
  } = useMemoryQuery(setExec);

  // --- テーブル仮想化（tanstack/react-virtual） -------------------------------
  const { tableContainerRef, virtualItems, totalSize } = useTableVirtualizer(
    pagedRows.length,
    { rowHeight: 36, overscan: 6 } // overscan: スクロール先読み行数
  );

  // --- View コンポーネントへ配線 ---------------------------------------------
  return (
    <MemoryPageView
      // Header
      title="メモリDB"
      caption="ブラウザのメモリ上で動作する一時DBです。ブラウザを閉じたり更新すると読み込んだデータは消えます。"

      // Dropzone
      busyForDrop={loading || parquetBusy || csvBusy} // 取り込み中はドラッグ無効化
      onDropFile={onDropFile}

      // Toolbar
      tables={tables}
      currentTable={currentTable}
      hasTable={hasTable}
      onChangeTable={setCurrentTable}
      onCount={() => doCount({ hasTable, currentTable })}
      onPreview={() => doPreview({ hasTable, currentTable })}
      onTableInfo={() => doTableInfo({ hasTable, currentTable })}
      exportSource={exportSource}
      onChangeExportSource={setExportSource}
      parquetCodec={parquetCodec}
      onChangeParquetCodec={setParquetCodec}
      parquetBusy={parquetBusy}
      parquetProgress={parquetProgress}
      onParquet={() => doParquet({ sql, hasTable, currentTable })}
      csvBusy={csvBusy}
      csvProgress={csvProgress}
      onCsv={() => doCsv({ sql, hasTable, currentTable, exportSource })}

      // SQL
      sql={sql}
      onChangeSql={setSql}
      onRunSql={() => execute({ ready, hasTable, sql })}
      loading={loading}
      schema={schemaDict}

      // Status
      statusText={status}
      execMs={execMs}

      // ResultTable
      columns={columns}
      pagedRows={pagedRows}
      tableContainerRef={tableContainerRef}
      virtualItems={virtualItems}
      totalSize={totalSize}
      paginationCount={paginationCount}
      rowsPerPage={rowsPerPage}
      page={page}
      onPageChange={async (_, p) => { await handlePageChange(p); }}
      onRowsPerPageChange={async (e) => { await handleRowsPerPageChange(e); }}
    />
  );
}
