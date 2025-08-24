"use client";

import * as React from "react";
import {
  Stack,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  SelectChangeEvent,
  Divider,
} from "@mui/material";
import type { ExportSource, ParquetCodec } from "@/features/memory/types/memory";

/**
 * MemoryToolbarProps
 * -----------------------------------------------------------------------------
 * メモリDBページの上部ツールバーで利用されるプロパティ群。
 * データ確認系のアクションボタンや、エクスポート系のオプションを包括的に制御する。
 *
 * - tables: 選択可能なテーブル一覧
 * - currentTable: 現在選択中のテーブル名
 * - hasTable: テーブルが選択可能かどうか（falseなら関連操作を無効化）
 * - onChangeTable: テーブル選択変更ハンドラ
 *
 * - onCount / onPreview / onTableInfo: データ件数/プレビュー/カラム情報取得ハンドラ
 *
 * - exportSource: エクスポート対象の選択肢（"table" or "sql"）
 * - onChangeExportSource: エクスポート対象変更ハンドラ
 *
 * - parquetCodec: Parquet 圧縮方式（zstd/snappy/uncompressed）
 * - onChangeParquetCodec: 圧縮方式変更ハンドラ
 * - parquetBusy: Parquet出力処理中フラグ
 * - parquetProgress: Parquet出力進捗率（%）
 * - onParquet: Parquetエクスポート実行ハンドラ
 *
 * - onCsv: CSVエクスポート実行ハンドラ（任意。未提供ならCSVボタンを無効化）
 * - csvBusy: CSV出力処理中フラグ
 * - csvProgress: CSV出力進捗率（%）
 */
export type MemoryToolbarProps = {
  // テーブル選択
  tables: string[];
  currentTable: string;
  hasTable: boolean;
  onChangeTable: (tbl: string) => void;

  // プリセット操作
  onCount: () => void | Promise<void>;
  onPreview: () => void | Promise<void>;
  onTableInfo: () => void | Promise<void>;

  // エクスポート共通（対象選択）
  exportSource: ExportSource;
  onChangeExportSource: (s: ExportSource) => void;

  // Parquet エクスポート
  parquetCodec: ParquetCodec;
  onChangeParquetCodec: (c: ParquetCodec) => void;
  parquetBusy: boolean;
  parquetProgress: number;
  onParquet: () => void | Promise<void>;

  // CSV エクスポート
  onCsv?: () => void | Promise<void>;
  csvBusy?: boolean;
  csvProgress?: number;
};

/**
 * MemoryToolbar
 * -----------------------------------------------------------------------------
 * メモリDBの操作用ツールバーコンポーネント。
 * - テーブル選択
 * - 件数取得 / プレビュー / カラム情報ボタン
 * - エクスポート対象選択（選択テーブル or 現在のSQL）
 * - Parquetエクスポート（圧縮方式指定 + 実行ボタン）
 * - CSVエクスポート（任意実装）
 *
 * UI設計:
 * - MUIのStackでレスポンシブ（縦→横並び切替）
 * - フラグに応じてボタン有効/無効や進捗表示を制御
 * - Tooltipでボタン説明や進捗表示を補助
 *
 * 利用想定:
 * - MemoryPage の上部に配置され、ユーザーが直接データ確認・エクスポート操作を行う。
 */
export default function MemoryToolbar({
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
  parquetBusy,
  parquetProgress,
  onParquet,
  onCsv,
  csvBusy,
  csvProgress,
}: MemoryToolbarProps) {
  const handleExportSourceChange = (e: SelectChangeEvent<string>) => {
    onChangeExportSource(e.target.value as ExportSource);
  };
  const handleParquetCodecChange = (e: SelectChangeEvent<string>) => {
    onChangeParquetCodec(e.target.value as ParquetCodec);
  };

  // "選択テーブル"が対象のときに hasTable=false ならエクスポート禁止
  const disableExportForTable = exportSource === "table" && !hasTable;

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      sx={{ mb: 1, alignItems: "center" }}
    >
      {/* テーブル選択セレクタ */}
      <FormControl sx={{ minWidth: 220 }}>
        <InputLabel id="table-label">テーブル</InputLabel>
        <Select
          labelId="table-label"
          label="テーブル"
          value={currentTable}
          onChange={(e) => onChangeTable(String(e.target.value))}
          displayEmpty
        >
          {tables.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* プリセット操作ボタン群 */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button variant="outlined" onClick={onCount} disabled={!hasTable}>
          件数
        </Button>
        <Button variant="outlined" onClick={onPreview} disabled={!hasTable}>
          プレビュー
        </Button>
        <Button variant="outlined" onClick={onTableInfo} disabled={!hasTable}>
          カラム情報
        </Button>
        <Divider orientation="vertical" flexItem />

        {/* エクスポート対象セレクタ */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="export-source-label">対象</InputLabel>
          <Select
            labelId="export-source-label"
            label="対象"
            value={exportSource}
            onChange={handleExportSourceChange}
          >
            <MenuItem value="table">選択テーブル</MenuItem>
            <MenuItem value="sql">現在のSQL</MenuItem>
          </Select>
        </FormControl>

        {/* Parquet 圧縮方式セレクタ */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="parquet-codec-label">Parquet圧縮</InputLabel>
          <Select
            labelId="parquet-codec-label"
            label="Parquet圧縮"
            value={parquetCodec}
            onChange={handleParquetCodecChange}
          >
            <MenuItem value="zstd">ZSTD（推奨）</MenuItem>
            <MenuItem value="snappy">Snappy（高速）</MenuItem>
            <MenuItem value="uncompressed">無圧縮</MenuItem>
          </Select>
        </FormControl>

        {/* Parquet エクスポートボタン */}
        <Tooltip
          title={
            parquetBusy
              ? `保存中… ${parquetProgress ?? 0}%`
              : "Parquetに変換して保存"
          }
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={onParquet}
              disabled={disableExportForTable || parquetBusy}
              startIcon={
                parquetBusy ? <CircularProgress size={16} /> : undefined
              }
            >
              Parquet変換
            </Button>
          </span>
        </Tooltip>

        {/* CSV エクスポートボタン */}
        <Tooltip
          title={
            csvBusy
              ? `保存中… ${csvProgress ?? 0}%`
              : "CSVでダウンロード"
          }
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={onCsv}
              disabled={disableExportForTable || csvBusy || !onCsv}
              startIcon={csvBusy ? <CircularProgress size={16} /> : undefined}
            >
              CSVダウンロード
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
