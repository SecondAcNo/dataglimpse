"use client";

import * as React from "react";
import {
  Paper, Stack, Typography, Chip,
  Table as MuiTable, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Box, Pagination, Select, MenuItem
} from "@mui/material";

/** 1行を { カラム名: 値 } の形で表す型 */
type Row = Record<string, unknown>;

/** セル表示用の整形関数 */
function formatCell(v: unknown) {
  if (v == null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** コンポーネントに渡す props（既存そのまま） */
type Props = {
  cols: string[];
  rows: Row[];
  totalRows: number;
  page: number; // 0-based
  rowsPerPage: number;
  onPageChange: (_: unknown, p: number) => void; // 0-based を受ける既存ハンドラ
  onRowsPerPageChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // 既存ハンドラ
};

export default function ResultTable(props: Props) {
  const { cols, rows, totalRows, page, rowsPerPage, onPageChange, onRowsPerPageChange } = props;

  // 総ページ数など（Pagination は 1-based）
  const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(rowsPerPage, 1)));
  const page1 = Math.min(page + 1, pageCount);
  const rangeStart = totalRows === 0 ? 0 : page * rowsPerPage + 1;
  const rangeEnd = Math.min((page + 1) * rowsPerPage, totalRows);

  /** セル共通スタイル */
  const cellSx = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 320,
  } as const;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ヘッダー部: 件数表示 */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">結果</Typography>
        <Chip label={`合計 ${totalRows.toLocaleString()} 行`} size="small" />
      </Stack>

      {/* テーブル本体（スクロール可能） */}
      <TableContainer sx={{ height: "clamp(240px, 50dvh, 60dvh)", borderRadius: 1 }}>
        <MuiTable stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: 700 }}>
          <TableHead>
            <TableRow>
              {cols.map((c) => (
                <TableCell key={c} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                {cols.map((c) => {
                  const text = formatCell(r[c]);
                  return (
                    <TableCell key={c} title={text} sx={cellSx}>
                      {text}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(cols.length, 1)}>
                  <Typography color="text.secondary">行がありません</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </MuiTable>
      </TableContainer>

      {/* ページネーション（置き換え版）：任意ページ/最初/最後へジャンプ + 行数変更 */}
      <Box
        sx={{
          mt: 1,
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        {/* 左：Rows per page + 範囲表示 */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">Rows per page:</Typography>
          <Select
            size="small"
            value={rowsPerPage}
            onChange={(e) => {
              const n = Number(e.target.value);
              // 既存シグネチャに合わせて「擬似イベント」を作って渡す
              const fake = { target: { value: String(n) } } as unknown as React.ChangeEvent<HTMLInputElement>;
              onRowsPerPageChange(fake);
              // 行数変更時は先頭ページへ
              onPageChange(e, 0);
            }}
          >
            {[20, 50, 100, 200, 500, 1000].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="body2">
            {rangeStart}-{rangeEnd} of {totalRows}
          </Typography>
        </Stack>

        {/* 右：ページ番号（1-based UI → 0-based ハンドラへ変換） */}
        <Pagination
          count={pageCount}
          page={page1}
          onChange={(_, v) => onPageChange(_, v - 1)}
          showFirstButton
          showLastButton
          shape="rounded"
          size="small"
          siblingCount={1}
          boundaryCount={1}
        />
      </Box>
    </Paper>
  );
}
