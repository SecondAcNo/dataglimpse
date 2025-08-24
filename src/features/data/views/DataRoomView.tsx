"use client";

import * as React from "react";
import {
  Box, Paper, Stack, Typography, Tabs, Tab, Tooltip, IconButton, Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

import type {
  TableBasic, ColumnMeta, QualityMetrics, Relation, Page,
} from "@/features/data/domain/types";
import type { RowObject } from "@/features/data/repositories/sqliteRepo";
import { TablePicker } from "@/features/data/components/TablePicker";
import { BasicCard } from "@/features/data/components/BasicCard";
import { ColumnsTable } from "@/features/data/components/ColumnsTable";
import { QualityPanel } from "@/features/data/components/QualityPanel";
import { RelationList } from "@/features/data/components/RelationList";
import { PreviewTable } from "@/features/data/components/PreviewTable";

export type DataRoomViewProps = {
  /** 左ペイン: テーブル一覧 */
  tables: string[];
  /** 選択中テーブル名 */
  selected?: string;
  /** アクティブタブ index: 0 基本 / 1 列 / 2 品質 / 3 リレーション / 4 プレビュー */
  tab: number;

  /** 右ペイン: 各種データ */
  basic: TableBasic | null;
  columns: ColumnMeta[] | null;
  quality: QualityMetrics | null;
  relations: Relation[] | null;
  preview: Page<RowObject> | null;

  /** ローディング／エラー */
  loading: boolean;
  err: string | null;

  /** ハンドラ群（Container/VM から注入） */
  setSelected: (v: string) => void;
  setTab: (v: number) => void;
  reloadSelected: () => void;
  handleLoadExtras: (colName: string) => void;
  handlePageChange: (page: number, pageSize: number) => void;

  /** CSV ダウンロードトリガ（実処理は Container / utils 側） */
  onDownloadCsv: () => void;
};

export function DataRoomView(props: DataRoomViewProps) {
  const {
    tables, selected, tab,
    basic, columns, quality, relations, preview,
    loading, err,
    setSelected, setTab, reloadSelected,
    handleLoadExtras, handlePageChange,
    onDownloadCsv,
  } = props;

  const FRAME_H = "84dvh";

  return (
    <Box sx={{ px: 0, pt: 0, pb: 2 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1.0, ml: 0 }}>
        データルーム
      </Typography>

      <Stack direction="row" spacing={2} sx={{ height: FRAME_H, minHeight: 0 }}>
        {/* 左ペイン：テーブル選択 */}
        <Box sx={{ width: 280, height: "100%", minHeight: 0 }}>
          <TablePicker tables={tables} value={selected} onChange={setSelected} />
        </Box>

        {/* 右ペイン：タブ＆内容 */}
        <Box sx={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Paper variant="outlined" sx={{ mb: 1, px: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons
                allowScrollButtonsMobile
              >
                <Tab label="基本" />
                <Tab label="列" />
                <Tab label="品質" />
                <Tab label="リレーション" />
                <Tab label="プレビュー" />
              </Tabs>

              <Stack direction="row" spacing={0.5}>
                <Tooltip title="再読込">
                  <span>
                    <IconButton onClick={reloadSelected} disabled={!selected}>
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="CSVダウンロード（プレビュー範囲）">
                  <span>
                    <IconButton
                      onClick={onDownloadCsv}
                      disabled={!preview || preview.rows.length === 0}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>

          {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}

          {!loading && <Box sx={{ display: tab === 0 ? "block" : "none" }}><BasicCard data={basic} /></Box>}

          {!loading && (
            <Box sx={{ display: tab === 1 ? "block" : "none" }}>
              <ColumnsTable columns={columns ?? []} onLoadExtras={handleLoadExtras} />
            </Box>
          )}

          {!loading && <Box sx={{ display: tab === 2 ? "block" : "none" }}><QualityPanel q={quality} /></Box>}

          {!loading && <Box sx={{ display: tab === 3 ? "block" : "none" }}><RelationList relations={relations} /></Box>}

          {/* プレビューは内部スクロール */}
          {!loading && (
            <Box sx={{ display: tab === 4 ? "flex" : "none", flex: 1, minHeight: 0 }}>
              <PreviewTable page={preview} onChange={handlePageChange} />
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
