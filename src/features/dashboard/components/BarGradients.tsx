"use client";

/**
 * Theme連動グラデーション
 * - テーマの theme.custom.chartPalette を使って <linearGradient> を生成
 * - 互換のため id は既存のまま（dgBlue / dgBlue1〜4）
 * - <BarGradients> は Recharts の <ComposedChart>/<BarChart> 直下で使う
 */

import * as React from "react";
import { useTheme } from "@mui/material/styles";
import { JSX } from "react";

export default function BarGradients(): JSX.Element {
  const theme = useTheme();

  // providers.tsx の module augmentation により型付きで参照可能
  const palette: readonly string[] = theme.custom.chartPalette;

  // n>=2 を想定。足りない場合は末尾色を再利用
  const c = (i: number) => palette[Math.min(i, palette.length - 1)];

  return (
    <defs>
      <linearGradient id="dgBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={c(2)} stopOpacity={0.95} />
        <stop offset="95%" stopColor={c(3)} stopOpacity={0.95} />
      </linearGradient>

      <linearGradient id="dgBlue1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={c(0)} stopOpacity={0.95} />
        <stop offset="95%" stopColor={c(1)} stopOpacity={0.95} />
      </linearGradient>

      <linearGradient id="dgBlue2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={c(1)} stopOpacity={0.95} />
        <stop offset="95%" stopColor={c(2)} stopOpacity={0.95} />
      </linearGradient>

      <linearGradient id="dgBlue3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={c(2)} stopOpacity={0.95} />
        <stop offset="95%" stopColor={c(3)} stopOpacity={0.95} />
      </linearGradient>

      <linearGradient id="dgBlue4" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={c(3)} stopOpacity={0.95} />
        <stop offset="95%" stopColor={c(4)} stopOpacity={0.95} />
      </linearGradient>
    </defs>
  );
}
