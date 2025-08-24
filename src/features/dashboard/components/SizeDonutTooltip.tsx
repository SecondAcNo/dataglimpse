"use client";

/**
 * SizeDonutTooltip
 * -----------------------------------------------------------------------------
 * RadialBarChart 用のカスタムツールチップ。payload の元データ(SizeDatum)を安全に取り出し、
 * テーブル名・行/列・行×列スコアを小さな MUI カードで表示する。
 * - Recharts <Tooltip content={<SizeDonutTooltip/>}> に差し込んで使用
 * - pointerEvents: none でホバー時のチラつきを防止
 * - payload 安全化のため型ガード isSizeDatum を使用
 */

import * as React from "react";
import { Paper, Typography } from "@mui/material";

// 円グラフ（RadialBarChart）用ツールチップの受領データ
type SizeDatum = { name: string; rows: number; cols: number; score: number };
type DonutTooltipItem = { payload?: SizeDatum };
type Props = { active?: boolean; payload?: DonutTooltipItem[] };

// 型ガード
function isSizeDatum(x: unknown): x is SizeDatum {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.rows === "number" &&
    typeof o.cols === "number" &&
    typeof o.score === "number"
  );
}

// RadialBarChart の <Tooltip content={<SizeDonutTooltip/>} /> に差す 
export default function SizeDonutTooltip({ active, payload }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  if (!p || !isSizeDatum(p.payload)) return null;
  const d = p.payload;
  return (
    <Paper elevation={3} sx={{ p: 1, fontSize: 12, pointerEvents: "none" }}>
      <Typography variant="subtitle2" fontWeight={700}>{d.name}</Typography>
      <Typography variant="caption" display="block">行: {d.rows.toLocaleString()}</Typography>
      <Typography variant="caption" display="block">列: {d.cols}</Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        行×列スコア: {d.score.toLocaleString()}
      </Typography>
    </Paper>
  );
}
