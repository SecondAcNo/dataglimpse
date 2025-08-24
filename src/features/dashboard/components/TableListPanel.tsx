"use client";

/**
 * TableListPanel
 * -----------------------------------------------------------------------------
 * テーブル一覧のView（検索・選択・一括操作・ページング）。ロジックは親に委譲。
 * - 中央リストのみスクロール: 外枠を flex column、リストに flex:1 + minHeight:0
 * - 読み込み中は Skeleton、通常時は pageItems を描画
 * - 行の右端にクイック操作（リネーム/削除）、選択状態は Set<string> で高速判定
 * - ページャは下部固定、表示レンジと総件数を併記
 */

import * as React from "react";
import {
  Box, Paper, Stack, Typography, IconButton, TextField, Button, Chip, Divider, 
  List, ListItem, ListItemText, Skeleton, Checkbox, ListItemIcon, Pagination
} from "@mui/material";
import { Refresh, Edit, Delete } from "@mui/icons-material";

export type TableListItem = { name: string; rows: number; cols: number };

type Props = {
  //読み込みフラグ
  loading: boolean;

  // フィルタ & ページング（親計算をそのまま利用）
  filter: string;
  onFilterChange: (v: string) => void;
  page: number;
  totalPages: number;
  startIndex: number;
  filteredCount: number;
  pageItems: TableListItem[];
  onPageChange: (p: number) => void;

  // 選択
  selected: Set<string>;
  onToggle: (name: string) => void;
  onSelectPage: () => void;
  onClearSelection: () => void;

  // アクション
  onRefresh: () => void;
  onOpenRename: (name: string) => void;
  onDelete: (name: string) => void;

  // 一括削除を親で開く
  onRequestBulkDelete: () => void;
};

export default function TableListPanel(props: Props) {
  const { loading, filter, onFilterChange, page, totalPages, startIndex, filteredCount, pageItems, onPageChange, 
    selected, onToggle, onSelectPage, onClearSelection, onRefresh, onOpenRename, onDelete, onRequestBulkDelete } = props;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 420,
      }}
    >
      {/* ヘッダ */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="h6" fontWeight={700}>
          テーブル一覧
        </Typography>
        <IconButton onClick={onRefresh} aria-label="refresh tables">
          <Refresh />
        </IconButton>
      </Stack>

      {/* 検索 */}
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="検索…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </Stack>

      {/* 一括操作バー（折り返し対応） */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ mb: 1, gap: 1, flexWrap: "wrap" }}
      >
        <Button size="small" onClick={onSelectPage}>
          表示中を全選択
        </Button>
        <Button
          size="small"
          onClick={onClearSelection}
          disabled={selected.size === 0}
        >
          選択解除
        </Button>
        <Button
          size="small"
          variant="contained"
          color="error"
          onClick={onRequestBulkDelete}
          disabled={selected.size === 0}
        >
          選択削除
        </Button>

        {/* 右寄せチップ。幅が足りなければ自動で折り返す */}
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" label={`選択 ${selected.size}`} />
      </Stack>

      <Divider sx={{ mb: 1 }} />

      {/* リスト（可変領域） */}
      <List
        dense
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ px: 2, py: 1.2 }}>
              <Skeleton height={18} />
            </Box>
          ))}

        {!loading &&
          pageItems.map((it) => {
            const checked = selected.has(it.name);
            return (
              <ListItem
                key={it.name}
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      aria-label="rename table"
                      onClick={() => onOpenRename(it.name)}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="delete table"
                      onClick={() => onDelete(it.name)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Checkbox
                    edge="start"
                    checked={checked}
                    onChange={() => onToggle(it.name)}
                    tabIndex={-1}
                    inputProps={{ "aria-label": `select ${it.name}` }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={it.name}
                  secondary={`${it.rows.toLocaleString()} 行 / ${it.cols} 列`}
                />
              </ListItem>
            );
          })}

        {!loading && filteredCount === 0 && (
          <Box sx={{ p: 2, color: "text.secondary" }}>
            テーブルがありません
            <br />
            CSVを取り込んでください
          </Box>
        )}
      </List>

      {/* ページャ（常に下部） */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ pt: 1 }}
      >
        <Typography variant="caption" color="text.secondary" noWrap>
          {filteredCount === 0
            ? "0 / 0"
            : `${startIndex}–${Math.min(
                startIndex + pageItems.length - 1,
                filteredCount
              )} / ${filteredCount}`}
        </Typography>
        <Pagination
          size="small"
          color="primary"
          page={page}
          count={totalPages}
          onChange={(_, p) => onPageChange(p)}
          showFirstButton
          showLastButton
        />
      </Stack>
    </Paper>
  );
}
