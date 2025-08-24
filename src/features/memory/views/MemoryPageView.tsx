"use client";

import type React from "react";
import { RefObject } from "react";
import { Box } from "@mui/material";

import MemoryHeader from "@/features/memory/components/MemoryHeader";
import DropzonePanel from "@/features/memory/components/DropzonePanel";
import MemoryToolbar from "@/features/memory/components/MemoryToolbar";
import SqlBoxDuck, { type SchemaDict } from "@/features/memory/components/SqlBoxDuck";
import MemoryStatus from "@/features/memory/components/MemoryStatus";
import ResultTable from "@/features/memory/components/ResultTable";

import type { RowData } from "@/lib/duck";
import type { ExportSource, ParquetCodec } from "@/features/memory/types/memory";
import type { VirtualItem } from "@tanstack/virtual-core";

export type MemoryPageViewProps = {
  // Header
  title?: string;
  caption?: string;

  // Dropzone
  busyForDrop?: boolean;
  onDropFile: (file: File) => void | Promise<void>;

  // Toolbar
  tables: string[];
  currentTable: string;
  hasTable: boolean;
  onChangeTable: (tbl: string) => void;
  onCount: () => void | Promise<void>;
  onPreview: () => void | Promise<void>;
  onTableInfo: () => void | Promise<void>;
  exportSource: ExportSource;
  onChangeExportSource: (s: ExportSource) => void;
  parquetCodec: ParquetCodec;
  onChangeParquetCodec: (c: ParquetCodec) => void;

  // CSV
  csvBusy: boolean;
  csvProgress: number;
  onCsv: () => void | Promise<void>;

  // Parquet
  parquetBusy: boolean;
  parquetProgress: number;
  onParquet: () => void | Promise<void>;

  // SQL 入力
  sql: string;
  onChangeSql: (s: string) => void;
  onRunSql: () => void | Promise<void>;
  loading: boolean;
  schema: SchemaDict;

  // ステータス
  statusText: string;
  execMs: number | null;

  // 結果テーブル
  columns: string[];
  pagedRows: RowData[];
  tableContainerRef: RefObject<HTMLDivElement | null>;
  virtualItems: VirtualItem[];
  totalSize: number;
  paginationCount: number;
  rowsPerPage: number;
  page: number;
  onPageChange: (e: unknown, page: number) => void | Promise<void>;
  onRowsPerPageChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void | Promise<void>;
};

export default function MemoryPageView({
  title = "メモリDB",
  caption = "ブラウザのメモリ上で動作する一時DBです。ブラウザを閉じたり更新すると読み込んだデータは消えます。",
  busyForDrop,
  onDropFile,

  tables,
  currentTable,
  hasTable,
  onChangeTable,
  onCount,
  onPreview,
  onTableInfo,
  exportSource,
  onChangeExportSource,
  parquetCodec,
  onChangeParquetCodec,

  // CSV
  csvBusy,
  csvProgress,
  onCsv,

  // Parquet
  parquetBusy,
  parquetProgress,
  onParquet,

  sql,
  onChangeSql,
  onRunSql,
  loading,
  schema,

  statusText,
  execMs,

  columns,
  pagedRows,
  tableContainerRef,
  virtualItems,
  totalSize,
  paginationCount,
  rowsPerPage,
  page,
  onPageChange,
  onRowsPerPageChange,
}: MemoryPageViewProps) {
  return (
    <Box>
      <MemoryHeader title={title} caption={caption} />

      {/* ドロップゾーン */}
      <DropzonePanel busy={!!busyForDrop} onDropFile={onDropFile} />

      {/* ツールバー */}
      <MemoryToolbar
        tables={tables}
        currentTable={currentTable}
        onChangeTable={onChangeTable}
        hasTable={hasTable}
        onCount={onCount}
        onPreview={onPreview}
        onTableInfo={onTableInfo}
        exportSource={exportSource}
        onChangeExportSource={onChangeExportSource}
        parquetCodec={parquetCodec}
        onChangeParquetCodec={onChangeParquetCodec}
        // CSV
        csvBusy={csvBusy}
        csvProgress={csvProgress}
        onCsv={onCsv}
        // Parquet
        parquetBusy={parquetBusy}
        parquetProgress={parquetProgress}
        onParquet={onParquet}
      />

      {/* SQL 入力 */}
      <Box sx={{ mb: 1 }}>
        <SqlBoxDuck value={sql} onChange={onChangeSql} onRun={onRunSql} loading={loading} schema={schema} />
      </Box>

      {/* ステータス */}
      <MemoryStatus
        status={statusText}
        execMs={execMs}
        parquetBusy={parquetBusy}
        parquetProgress={parquetProgress}
        loading={loading}
      />

      {/* 結果テーブル */}
      <ResultTable
        columns={columns}
        pagedRows={pagedRows}
        tableContainerRef={tableContainerRef}
        virtualItems={virtualItems}
        totalSize={totalSize}
        paginationCount={paginationCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </Box>
  );
}
