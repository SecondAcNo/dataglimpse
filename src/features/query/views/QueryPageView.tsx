"use client";

import * as React from "react";
import { Stack, Typography, Alert } from "@mui/material";

import ResultTable from "@/features/query/components/ResultTable";
import HistoryDialog from "@/features/query/components/HistoryDialog";
import EditorPanel from "@/features/query/components/EditorPanel";

/* ========= types ========= */
export type Row = Record<string, unknown>;
export type HistoryItem = { id: string; sql: string; ts: number; favorite: boolean };
export type SchemaEntry = { table: string; columns: string[] };

type Props = {
  // 状態
  sql: string;
  formatting: boolean;
  loading: boolean;
  hasTables: boolean;

  cols: string[];
  rows: Row[];
  totalRows: number;
  page: number;
  rowsPerPage: number;
  info: string | null;
  error: string | null;
  schema: SchemaEntry[];

  historyOpen: boolean;
  history: HistoryItem[];

  // ハンドラ
  setSql: (v: string) => void;
  onRun: () => Promise<void>;
  onFormat: () => void;
  onCopySql: () => Promise<void>;
  onExportCsv: () => void;

  onPageChange: (_: unknown, p: number) => void;
  onRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  openHistory: () => void;
  closeHistory: () => void;
  onHistoryToggleFav: (id: string) => void;
  onHistoryRemove: (id: string) => void;
  onHistoryClearAll: () => void;
  onHistoryUse: (sql: string) => void;
  onHistoryRun: (sql: string) => Promise<void>;
};

export default function QueryPageView(props: Props) {
  const {
    sql, setSql, formatting, loading, hasTables,
    cols, rows, totalRows, page, rowsPerPage, info, error, schema,
    onRun, onFormat, onCopySql, onExportCsv,
    onPageChange, onRowsPerPageChange,
    historyOpen, history, openHistory, closeHistory,
    onHistoryToggleFav, onHistoryRemove, onHistoryClearAll, onHistoryUse, onHistoryRun,
  } = props;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>クエリ</Typography>

      {/* 空状態 */}
      {!hasTables && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          テーブルが見つかりません。まずダッシュボードでCSVを取り込んでください。
        </Alert>
      )}

      {/* エディタ + アクション */}
      <EditorPanel
        sql={sql}
        setSql={setSql}
        hasTables={hasTables}
        loading={loading}
        formatting={formatting}
        schema={schema}
        info={info}
        error={error}
        rowsLength={rows.length}
        onRun={onRun}
        onFormat={onFormat}
        onCopySql={onCopySql}
        onExportCsv={onExportCsv}
        onOpenHistory={openHistory}
      />

      {/* 結果 */}
      {hasTables && cols.length > 0 && (
        <ResultTable
          cols={cols}
          rows={rows}
          totalRows={totalRows}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}

      {/* 履歴ダイアログ */}
      <HistoryDialog
        open={historyOpen && hasTables}
        history={history}
        onClose={closeHistory}
        onClearAll={onHistoryClearAll}
        onToggleFav={onHistoryToggleFav}
        onRemove={onHistoryRemove}
        onUse={onHistoryUse}
        onRun={onHistoryRun}
      />
    </Stack>
  );
}
