"use client";

import * as React from "react";
import { Paper, Typography, Divider, Chip, Alert, Stack, Box } from "@mui/material";
import type { TableBasic } from "@/features/data/domain/types";

/**
 * KV コンポーネント
 * -----------------------------------------------------------------------------
 * - 「キー: 値」形式の情報を横並びで表示するための小さなユーティリティ。
 * - 左側に固定幅のキー、右側に可変幅の値を配置する。
 * - レイアウトは Stack (row) を利用し、MUI の Box で余白や色を調整。
 * 
 * @param k ReactNode 表示するキー（ラベル側）
 * @param v ReactNode 表示する値（値側）
 */
function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 0.5 }}>
      <Box sx={{ width: 160, color: "text.secondary" }}>{k}</Box>
      <Box sx={{ flex: 1 }}>{v}</Box>
    </Stack>
  );
}

/**
 * BasicCard コンポーネント
 * -----------------------------------------------------------------------------
 * - DataRoom 画面で「テーブルの基本情報（名前・行数・列数）」を表示するカード。
 * - `TableBasic` 型（name, rowCount, colCount）を受け取り、各情報を表形式で出力する。
 * - データが null の場合は「テーブルを選択してください」というアラートを表示し、
 *   選択前の UI 状態を明示する。
 * - MUI の Paper をカード枠、Typography/Divider で見出し、Chip でテーブル名を表示。
 *
 * 利用シーン:
 * - テーブルリストから任意のテーブルをクリックした後に、基礎情報の確認を行う用途。
 *
 * @param data TableBasic | null - 表示対象のテーブル基本情報
 */
export function BasicCard({ data }: { data: TableBasic | null }) {
  if (!data) return <Alert severity="info">テーブルを選択してください</Alert>;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>基本情報</Typography>
      <Divider sx={{ mb: 1 }} />
      <KV k="テーブル名" v={<Chip label={data.name} />} />
      <KV k="行数" v={new Intl.NumberFormat().format(data.rowCount)} />
      <KV k="列数" v={data.colCount} />
    </Paper>
  );
}
