"use client";

import * as React from "react";
import {
  Paper, Typography, Divider, TableContainer,
  Table as MuiTable, TableHead, TableRow, TableCell, TableBody,
  Alert, Box, Stack, Pagination, Select, MenuItem
} from "@mui/material";
import type { Page } from "@/features/data/domain/types";
import type { RowObject } from "@/features/data/repositories/sqliteRepo";

/**
 * cellToString ユーティリティ
 */
const cellToString = (v: unknown): string => {
  if (v == null) return "";
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export function PreviewTable({
  page,
  onChange,
}: {
  page: Page<RowObject> | null;
  onChange: (page: number, pageSize: number) => void;
}) {
  const cols = React.useMemo(() => {
    if (!page) return [] as string[];
    const first = (page.rows[0] ?? {}) as RowObject;
    return Object.keys(first);
  }, [page]);

  if (!page) return <Alert severity="info">テーブルを選択してください</Alert>;

  // ページネーション計算
  const rowsPerPage = page.pageSize;
  const totalRows = page.totalRows;
  const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(rowsPerPage, 1)));
  const page1 = Math.min(page.page + 1, pageCount);
  const rangeStart = totalRows === 0 ? 0 : page.page * rowsPerPage + 1;
  const rangeEnd = Math.min((page.page + 1) * rowsPerPage, totalRows);

  const cellSx = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 320,
  } as const;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        データプレビュー
      </Typography>
      <Divider sx={{ mb: 1 }} />

      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto", borderRadius: 1 }}>
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
            {page.rows.map((r, i) => (
              <TableRow key={i} hover>
                {cols.map((c) => {
                  const text = cellToString((r as RowObject)[c]);
                  return (
                    <TableCell key={c} title={text} sx={cellSx}>
                      {text}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {page.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(cols.length, 1)}>
                  <Typography color="text.secondary">行がありません</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </MuiTable>
      </TableContainer>

      {/* 置き換えたページネーション */}
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
            onChange={(e) => onChange(0, Number(e.target.value))}
          >
            {[20, 50, 100, 200, 500, 1000].map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </Select>
          <Typography variant="body2">
            {rangeStart}-{rangeEnd} of {totalRows}
          </Typography>
        </Stack>

        {/* 右：ページ番号 */}
        <Pagination
          count={pageCount}
          page={page1}
          onChange={(_, v) => onChange(v - 1, rowsPerPage)}
          showFirstButton
          showLastButton
          shape="rounded"
          siblingCount={1}   // 中間の「…」の前後に表示する数
          boundaryCount={1}  // 先頭/末尾側に常時表示する数
          size="small"
        />
      </Box>
    </Paper>
  );
}
