"use client";

import * as React from "react";
import {
  Paper, Typography, Divider, Stack, Box, Chip, Alert
} from "@mui/material";
import type { QualityMetrics } from "@/features/data/domain/types";

/**
 * QualityPanel コンポーネント
 * -----------------------------------------------------------------------------
 * データ品質に関するメトリクス（欠損率・重複率）を視覚的に表示するパネル。
 *
 * 主な責務:
 * - `QualityMetrics` 型の品質情報を受け取り、テーブル品質を可視化する。
 * - 欠損率: 列ごとに棒グラフ（割合バー）を描画し、直感的に理解可能にする。
 * - 重複率: 全行が同一であるケースを簡易判定し、その割合を Chip で表示する。
 *
 * UI の特徴:
 * - 欠損率はプログレスバー風の表示で、最大幅を100%として視覚化。
 * - パーセンテージは小数点以下を四捨五入して整数表記。
 * - `q` が null の場合は、対象未選択として情報アラートを返す。
 *
 * @param q QualityMetrics | null
 *        - null: テーブル未選択時（アラートを表示）
 *        - QualityMetrics: 品質メトリクス
 */
export function QualityPanel({ q }: { q: QualityMetrics | null }) {
  // データ未選択時のフォールバック
  if (!q) return <Alert severity="info">テーブルを選択してください</Alert>;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* セクションタイトル */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        品質・ステータス
      </Typography>
      <Divider sx={{ mb: 1 }} />

      {/* 欠損率（列ごと） */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        欠損率（列ごと）
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        {Object.entries(q.nullRateByCol).map(([k, v]) => (
          <Stack
            key={k}
            direction="row"
            spacing={1}
            alignItems="center"
          >
            {/* 列名 */}
            <Box sx={{ width: 200, color: "text.secondary" }}>{k}</Box>

            {/* バーグラフ部分 */}
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  height: 6,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                }}
              >
                <Box
                  sx={{
                    width: `${Math.round(v * 100)}%`,
                    height: 6,
                    bgcolor: "primary.main",
                    borderRadius: 1,
                  }}
                />
              </Box>
            </Box>

            {/* 数値パーセンテージ表示 */}
            <Box sx={{ width: 56, textAlign: "right" }}>
              {Math.round(v * 100)}%
            </Box>
          </Stack>
        ))}
      </Stack>

      {/* 重複率 */}
      <Typography variant="subtitle2">
        重複率（全行同一重複の簡易判定）
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <Chip
          label={`${Math.round((q.duplicateRowRate ?? 0) * 100)}%`}
        />
      </Box>
    </Paper>
  );
}
