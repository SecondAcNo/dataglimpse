"use client";

import { Typography } from "@mui/material";

/**
 * MemoryStatusProps
 * ---------------------------------------------------------------------------
 * - status: 現在の状態メッセージ（SQL 実行結果や状況説明など）
 * - execMs: 実行時間（ミリ秒）。null の場合は未表示
 * - parquetBusy: Parquet 書き出し処理中かどうか
 * - parquetProgress: Parquet 書き出し進捗率（0〜100）
 * - loading: クエリ実行などの処理中フラグ
 * - sx: 外部から追加スタイルを適用するためのオプション
 */
export type MemoryStatusProps = {
  status: string;              // 状態メッセージ本体
  execMs: number | null;       // 実行時間（ms単位）。nullなら非表示
  parquetBusy: boolean;        // Parquet保存処理中フラグ
  parquetProgress: number;     // Parquet保存の進行度
  loading: boolean;            // 全体的な処理中状態フラグ
  sx?: Record<string, unknown>; // MUIのsxスタイル拡張
};

/**
 * MemoryStatus
 * ---------------------------------------------------------------------------
 * メモリDBページ下部に表示する「現在の状態」をテキストで描画するコンポーネント。
 * - 主に SQL 実行後の結果メッセージや処理時間を表示
 * - Parquetエクスポート進行中は進捗率を追記
 * - クエリ実行中やファイル変換処理中には「処理中…」を表示
 * - 見た目は MUI Typography (variant=body2, text.secondary) で統一
 * - 外部スタイルは sx props で上書き可能
 *
 * 利用シーン:
 * - MemoryPage の下部にステータス行として配置
 * - 長時間処理やエクスポート進行度をユーザにフィードバック
 */
export default function MemoryStatus({
  status,
  execMs,
  parquetBusy,
  parquetProgress,
  loading,
  sx,
}: MemoryStatusProps) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, ...sx }}>
      {status}
      {execMs !== null ? ` / 実行時間: ${execMs}ms` : ""} 
      {parquetBusy ? ` / Parquet保存中… ${parquetProgress}%` : ""} 
      {loading ? "（処理中…）" : ""}
    </Typography>
  );
}
