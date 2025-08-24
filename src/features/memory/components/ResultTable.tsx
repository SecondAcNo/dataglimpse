"use client";

import * as React from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Stack,
  Pagination,
  Select,
  MenuItem,
  Typography,
} from "@mui/material";
import type { RefObject } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { RowData } from "@/lib/duck";

/**
 * Props
 * -----------------------------------------------------------------------------
 * ResultTable コンポーネントの入力プロパティ。
 */
type Props = {
  columns: string[];
  pagedRows: RowData[];

  // 仮想化
  tableContainerRef: RefObject<HTMLDivElement | null>;
  virtualItems: VirtualItem[];
  totalSize: number;

  // ページネーション
  paginationCount: number; // 総行数
  rowsPerPage: number;
  page: number; // 0-based
  onPageChange: (_: unknown, p: number) => Promise<void> | void; // 0-based で受ける
  onRowsPerPageChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => Promise<void> | void;
};

/**
 * ResultTable
 * -----------------------------------------------------------------------------
 * 大量データを効率的に表示する仮想化対応テーブル。
 */
export default function ResultTable({
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
}: Props) {
  // 可視リストの先頭〜末尾に基づき上下パディングを算出
  const topPad = virtualItems.length ? virtualItems[0].start : 0;
  const last = virtualItems.length ? virtualItems[virtualItems.length - 1] : undefined;
  const bottomPad = virtualItems.length ? totalSize - (last?.end ?? 0) : 0;

  // Pagination（1-based UI）のための計算
  const pageCount = Math.max(1, Math.ceil(paginationCount / Math.max(rowsPerPage, 1)));
  const page1 = Math.min(page + 1, pageCount);
  const rangeStart = paginationCount === 0 ? 0 : page * rowsPerPage + 1;
  const rangeEnd = Math.min((page + 1) * rowsPerPage, paginationCount);

  return (
    <Paper variant="outlined">
      {/* スクロール可能領域 */}
      <TableContainer sx={{ height: 520, overflowX: "auto" }} ref={tableContainerRef}>
        <Table stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: 560 }}>
          {/* ヘッダー */}
          <TableHead>
            <TableRow>
              {columns.length === 0 ? (
                <TableCell>結果なし</TableCell>
              ) : (
                columns.map((c) => (
                  <TableCell key={c} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {c}
                  </TableCell>
                ))
              )}
            </TableRow>
          </TableHead>

          {/* 本体 */}
          {columns.length === 0 ? (
            <TableBody />
          ) : (
            <TableBody>
              {/* 上パディング（スクロールオフセット表現用） */}
              {topPad > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(1, columns.length)}
                    sx={{ p: 0, border: 0, height: topPad }}
                  />
                </TableRow>
              )}

              {/* 可視範囲の行のみ描画 */}
              {virtualItems.map((vi) => {
                const r = pagedRows[vi.index];
                return (
                  <TableRow
                    key={vi.key}
                    hover
                    sx={{
                      height: vi.size,
                      "& > td": {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 320,
                      },
                    }}
                  >
                    {columns.map((c) => (
                      <TableCell key={c} title={r[c] === null ? "NULL" : String(r[c])}>
                        {r[c] === null ? "NULL" : String(r[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

              {/* 下パディング */}
              {bottomPad > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(1, columns.length)}
                    sx={{ p: 0, border: 0, height: bottomPad }}
                  />
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>
      </TableContainer>

      {/* ページネーション（置き換え版） */}
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
              // 既存の onRowsPerPageChange シグネチャに合わせて擬似イベントを渡す
              const fake = {
                target: { value: String(n) },
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              void (async () => {
                await onRowsPerPageChange(fake);
                // 行数変更時は先頭ページへ
                await onPageChange(e, 0);
              })();
            }}
          >
            {[10, 20, 50, 100, 200, 500, 1000].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="body2">
            {rangeStart}-{rangeEnd} of {paginationCount}
          </Typography>
        </Stack>

        {/* 右：ページ番号（1-based UI → 0-based コールバック） */}
        <Pagination
          count={pageCount}
          page={page1}
          onChange={(_, v) => {
            void (async () => {
              await onPageChange(_, v - 1);
            })();
          }}
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
