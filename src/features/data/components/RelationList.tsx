"use client";

import * as React from "react";
import {
  Paper, Typography, Divider, Stack, Chip, Alert
} from "@mui/material";
import type { Relation } from "@/features/data/domain/types";

/**
 * RelationList コンポーネント
 * -----------------------------------------------------------------------------
 * テーブル間のリレーション（外部キー候補）を一覧形式で表示する UI コンポーネント。
 *
 * 主な責務:
 * - `Relation[]` 型で与えられる推定リレーション情報をカード形式で列挙する。
 * - 子→親 / 親→子 の関係をラベル付きで明示。
 * - リレーション例（JOIN 例文など）を補足情報として表示。
 *
 * @param relations Relation[] | null
 *        - null: テーブル未選択状態
 *        - []: 推定リレーションが存在しない場合
 *        - Relation[]: 推定されたリレーション情報の配列
 */
export function RelationList({ relations }: { relations: Relation[] | null }) {
  if (!relations) return <Alert severity="info">テーブルを選択してください</Alert>;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* セクションタイトル */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        リレーション（推定）
      </Typography>
      <Divider sx={{ mb: 1 }} />

      {/* リレーションが推定できなかった場合 */}
      {relations.length === 0 && (
        <Typography color="text.secondary">推定できませんでした</Typography>
      )}

      {/* リレーション一覧表示 */}
      <Stack spacing={1}>
        {relations.map((r, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
            {/* リレーション概要行（方向ラベル＋接続情報） */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Chip
                size="small"
                label={r.direction === "child" ? "子→親" : "親→子"}
              />
              <Typography variant="body2">
                <b>{r.fromTable}.{r.fromColumn}</b>
                {" "}→{" "}
                <b>{r.toTable}.{r.toColumn}</b>
              </Typography>
            </Stack>

            {/* 補足情報（JOIN例など） */}
            <Typography variant="caption" color="text.secondary">
              {r.joinExample}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
