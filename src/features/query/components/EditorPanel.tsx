"use client";

import * as React from "react";
import { Box, Button, IconButton, Paper, Stack, Typography, Tooltip } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import DownloadIcon from "@mui/icons-material/Download";
import { useTheme } from "@mui/material/styles";
import CodeMirror from "@uiw/react-codemirror";
import { sql as cmSql } from "@codemirror/lang-sql";
import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";

/** スキーマ情報: テーブル名と列のリスト */
export type SchemaEntry = { table: string; columns: string[] };

/** コンポーネントに渡す props */
type Props = {
  sql: string;                        // 入力中のSQL文字列
  setSql: (v: string) => void;        // SQL変更時に呼ばれるハンドラ
  hasTables: boolean;                 // テーブルが存在するか（SQL入力可能かどうか）
  loading: boolean;                   // 実行中フラグ
  formatting: boolean;                // 整形中フラグ
  schema: SchemaEntry[];              // スキーマ（補完用）
  info: string | null;                // 情報メッセージ
  error: string | null;               // エラーメッセージ
  rowsLength: number;                 // 実行結果の行数（0ならCSVエクスポート不可）
  onRun: () => Promise<void>;         // SQL実行ハンドラ
  onFormat: () => void;               // SQL整形ハンドラ
  onCopySql: () => Promise<void>;     // SQLコピー（クリップボード）ハンドラ
  onExportCsv: () => void;            // CSVエクスポートハンドラ
  onOpenHistory: () => void;          // 実行履歴ダイアログを開くハンドラ
};

/**
 * SQLエディタパネル
 * - CodeMirror を利用した SQL 入力欄
 * - 実行 / 整形 / コピー / 履歴 / CSVエクスポート の操作ボタン群
 * - エラー/情報メッセージ表示
 */
export default function EditorPanel({
  sql, setSql, hasTables, loading, formatting, schema, info, error, rowsLength,
  onRun, onFormat, onCopySql, onExportCsv, onOpenHistory,
}: Props) {
  const theme = useTheme();

  /**
   * CodeMirror 用のスキーマベース補完関数
   * - テーブル名、テーブル.カラム名 を候補として提示する
   */
  const cmCompletion = React.useCallback((ctx: CompletionContext) => {
    const word = ctx.matchBefore(/[\w".]+/);
    if (!word && !ctx.explicit) return null;

    const items: Completion[] = [];
    for (const t of schema) {
      // テーブル名の候補
      items.push({ label: t.table, type: "class", apply: `"${t.table.replace(/"/g, '""')}"` });
      // カラム名の候補（table.column 形式）
      for (const c of t.columns) {
        items.push({
          label: `${t.table}.${c}`,
          type: "property",
          apply: `"${t.table.replace(/"/g, '""')}"."${c.replace(/"/g, '""')}"`,
        });
      }
    }
    return { from: word ? word.from : ctx.pos, options: items, validFor: /[\w".]+/ };
  }, [schema]);

  /** CodeMirror の拡張設定 */
  const cmExtensions = React.useMemo(() => [
    cmSql(), // SQL構文ハイライト
    autocompletion({ override: [cmCompletion] }), // スキーマ補完
  ], [cmCompletion]);

  return (
    <Paper variant="outlined" sx={{ p: 2, position: "relative" }}>
      {/* hasTables=false の場合は半透明表示で操作不可に近い状態に */}
      <Stack spacing={1} sx={{ opacity: hasTables ? 1 : 0.55 }}>
        {/* SQL入力欄 */}
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
          <CodeMirror
            value={sql}
            height="220px"
            basicSetup={{ lineNumbers: true, autocompletion: true, foldGutter: true }}
            extensions={cmExtensions}
            theme={theme.palette.mode === "dark" ? oneDark : undefined}
            onChange={setSql}
            editable={hasTables}
          />
        </Box>

        {/* ボタン群（左: 実行・整形・履歴・コピー、右: CSV出力） */}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1}>
            {/* SQL実行 */}
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={onRun}
              disabled={!hasTables || loading || sql.trim().length === 0}
            >
              {loading ? (formatting ? "整形→実行中..." : "実行中...") : "実行"}
            </Button>

            {/* SQL整形 */}
            <Tooltip title="SQL整形">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<FormatAlignLeftIcon />}
                  onClick={onFormat}
                  disabled={!hasTables || loading || formatting}
                >
                  {formatting ? "整形中..." : "整形"}
                </Button>
              </span>
            </Tooltip>

            {/* 履歴ダイアログを開く */}
            <Tooltip title="履歴">
              <span>
                <IconButton onClick={onOpenHistory} disabled={!hasTables}>
                  <HistoryIcon />
                </IconButton>
              </span>
            </Tooltip>

            {/* SQLをコピー */}
            <Tooltip title="SQLをコピー">
              <span>
                <IconButton onClick={onCopySql} disabled={!hasTables}>
                  <ContentCopyIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* CSVエクスポート */}
          <Stack direction="row" spacing={1}>
            <Tooltip title="CSVエクスポート（現在ページ）">
              <span>
                <IconButton onClick={onExportCsv} disabled={!hasTables || rowsLength === 0}>
                  <DownloadIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* メッセージ表示 */}
        {error && <Typography color="error">{error}</Typography>}
        {info && !error && <Typography color="text.secondary">{info}</Typography>}
      </Stack>
    </Paper>
  );
}
