"use client";

/**
 * HighlightColors
 * -----------------------------------------------------------------------------
 * チャートの強調用線・補助線などで使う <defs> 色定義。
 * - id: dgGrid, dgRef, dgLine を用意
 * - BarGradients と同じく <ComposedChart>/<RadialBarChart> 直下に配置
 */

import * as React from "react";
import { useTheme, alpha  } from "@mui/material/styles";
import { JSX } from "react";

export default function HighlightColors(): JSX.Element {
  const theme = useTheme();
  const colors = theme.custom.chartPalette;
  const last = Math.max(0, colors.length - 1);

  // ダーク: 白の薄いアルファ → 中間グレーに見える
  // ライト: 黒の薄いアルファ → 薄いグレーに見える
  const isDark = theme.palette.mode === "dark";
  const track0 = isDark ? alpha("#fff", 0.22) : alpha("#000", 0.08);
  const track1 = isDark ? alpha("#fff", 0.14) : alpha("#000", 0.04);

  // グリッド/参照/ラインはテーマパレット連動のまま
  const gridColor = isDark ? alpha("#fff", 0.18) : alpha("#000", 0.10);
  const refColor  = colors[Math.min(1, last)];
  const lineColor = colors[Math.min(4, last)];

  return (
    <defs>
      {/* グリッド線（淡いグレー） */}
      <linearGradient id="dgGrid" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={gridColor} />
        <stop offset="100%" stopColor={gridColor} />
      </linearGradient>

      {/* 参照線（しきい値） */}
      <linearGradient id="dgRef" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={refColor} />
        <stop offset="100%" stopColor={refColor} />
      </linearGradient>

      {/* 折れ線 */}
      <linearGradient id="dgLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={lineColor} />
        <stop offset="100%" stopColor={lineColor} />
      </linearGradient>

      {/* RadialBar 背景トラック（グレー寄り） */}
      <linearGradient id="dgTrack" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor={track0} />
        <stop offset="100%" stopColor={track1} />
      </linearGradient>
    </defs>
  );
}
