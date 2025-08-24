"use client";

import * as React from "react";
import {
  Paper, Stack, TextField, IconButton, Divider, Box, Typography, Pagination
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

/**
 * TablePicker コンポーネント
 * -----------------------------------------------------------------------------
 * DB に存在するテーブル一覧から 1 つを選択するための UI コンポーネント。
 *
 * 主な責務:
 * - 与えられたテーブル名配列を検索・ページング付きで表示。
 * - ユーザーが選択したテーブル名をコールバック `onChange` で通知。
 *
 * UI 構造:
 * - 検索ボックス (`TextField` + 検索アイコン)
 * - 区切り線 (`Divider`)
 * - テーブル一覧 (スクロール可能、選択状態はハイライト)
 * - ページ情報とページネーション (`Pagination`)
 *
 * 状態管理:
 * - `q`: 検索クエリ文字列
 * - `page`: 現在のページ番号 (1-based)
 * - `PAGE_SIZE`: 1ページあたり表示件数（固定値 12）
 *
 * フィルタリングとページング:
 * - `filtered`: 検索クエリに一致するテーブル名一覧
 * - `pageItems`: 現在のページで表示するテーブル名
 * - `totalPages`: ページ総数
 * - 検索クエリ変更時はページ番号を 1 にリセット。
 * - `page > totalPages` となった場合は自動で修正。
 *
 * フォールバック挙動:
 * - `filtered.length === 0` → 「該当なし」と表示。
 * - ページング表示には「表示範囲 / 総件数」を明示。
 *
 * @param tables string[]
 *        - 全テーブル名の配列
 * @param value string | undefined
 *        - 現在選択されているテーブル名
 * @param onChange (v: string) => void
 *        - ユーザーがテーブルをクリックした際に呼ばれるコールバック
 */
export function TablePicker({
  tables, value, onChange,
}: { tables: string[]; value?: string; onChange: (v: string) => void }) {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 12;

  // 検索フィルタリング
  const filtered = React.useMemo(
    () => tables.filter((t) => t.toLowerCase().includes(q.toLowerCase())),
    [tables, q]
  );

  // ページ計算
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // ページ番号が総数を超えた場合は修正
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // 検索クエリ変更時はページをリセット
  React.useEffect(() => { setPage(1); }, [q]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto auto 1fr auto",
        gap: 0.75,
      }}
    >
      {/* 検索ボックス */}
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          fullWidth
          placeholder="テーブル検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <IconButton aria-label="search">
          <SearchIcon />
        </IconButton>
      </Stack>

      <Divider sx={{ my: 0.25 }} />

      {/* テーブル一覧 */}
      <Box sx={{ overflowY: "auto", minHeight: 0 }}>
        {pageItems.map((t) => (
          <Box
            key={t}
            onClick={() => onChange(t)}
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 1,
              cursor: "pointer",
              bgcolor: t === value ? "action.selected" : "transparent",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Typography variant="body2" noWrap>
              {t}
            </Typography>
          </Box>
        ))}
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            該当なし
          </Typography>
        )}
      </Box>

      {/* ページ情報 + ページネーション */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ pt: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary">
          {filtered.length === 0
            ? "0 / 0"
            : `${start + 1}–${Math.min(
                start + pageItems.length,
                filtered.length
              )} / ${filtered.length}`}
        </Typography>
        <Pagination
          size="small"
          color="primary"
          page={page}
          count={totalPages}
          onChange={(_, p) => setPage(p)}
          showFirstButton
          showLastButton
        />
      </Stack>
    </Paper>
  );
}
