"use client";

import * as React from "react";
import {
  Paper, Stack, Typography, Button, Divider,
  Table as MuiTable, TableHead, TableRow, TableCell, TableBody, Chip
} from "@mui/material";
import type { ColumnMeta } from "@/features/data/domain/types";

/**
 * cellToString ユーティリティ
 * -----------------------------------------------------------------------------
 * - セル値（unknown型）をテキスト化して UI に安全に表示する。
 * - null/undefined → 空文字
 * - オブジェクト   → JSON.stringify によるシリアライズ
 * - それ以外       → String() による文字列化
 *
 * @param v unknown - 変換対象の値
 * @returns string - 表示用文字列
 */
const cellToString = (v: unknown) =>
  v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v));

/**
 * ColumnsTable コンポーネント
 * -----------------------------------------------------------------------------
 * - テーブルの「列メタ情報」を表形式で一覧表示する UI コンポーネント。
 * - 列名・型・NULL 許容・PK・Unique 制約などの基本情報に加え、
 *   Distinct 値のカウントやサンプル値も表示する。
 * - Distinct 値やサンプル値が未取得の場合は「取得」ボタンを出し、
 *   onLoadExtras コールバックを介して上位サービスにデータ取得を依頼する。
 *
 * 主な特徴:
 * - 「一括取得」ボタンで全列に対し onLoadExtras を実行可能。
 * - サンプル値は Chip 群として表示され、横並びかつ wrap 表示で視認性を確保。
 * - Hover 可能な TableRow により、どの列が対象か即座に把握できる。
 *
 * @param columns ColumnMeta[] - 表示する列のメタ情報一覧
 * @param onLoadExtras? (name: string) => void
 *        列名を引数に、Distinct/サンプル値を取得する処理を呼び出すコールバック
 */
export function ColumnsTable({
  columns,
  onLoadExtras,
}: { columns: ColumnMeta[]; onLoadExtras?: (name: string) => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* ヘッダー: タイトルと「一括取得」ボタン */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="h6">列メタ情報</Typography>
      </Stack>
      <Divider sx={{ mb: 1 }} />

      {/* メタ情報テーブル */}
      <MuiTable size="small">
        <TableHead>
          <TableRow>
            <TableCell>列名</TableCell>
            <TableCell>型</TableCell>
            <TableCell>Null</TableCell>
            <TableCell>PK</TableCell>
            <TableCell>Unique</TableCell>
            <TableCell>Distinct</TableCell>
            <TableCell>サンプル</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {columns.map((c) => (
            <TableRow key={c.name} hover>
              {/* 列名 */}
              <TableCell>
                <Typography variant="body2">{c.name}</Typography>
              </TableCell>
              {/* 型情報 */}
              <TableCell>{c.dataType}</TableCell>
              {/* NULL 許容 */}
              <TableCell>{c.nullable ? "YES" : "NO"}</TableCell>
              {/* 主キー */}
              <TableCell>{c.isPrimaryKey ? "YES" : ""}</TableCell>
              {/* ユニーク制約 */}
              <TableCell>{c.isUnique ? "YES" : ""}</TableCell>
              {/* Distinct 件数 */}
              <TableCell>
                {typeof c.distinctCount === "number" ? (
                  c.distinctCount
                ) : (
                  <Button size="small" onClick={() => onLoadExtras?.(c.name)}>
                    取得
                  </Button>
                )}
              </TableCell>
              {/* サンプル値 */}
              <TableCell>
                {c.sampleValues ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: "wrap" }}
                  >
                    {c.sampleValues.map((v, i) => (
                      <Chip key={i} size="small" label={cellToString(v)} />
                    ))}
                  </Stack>
                ) : (
                  <Button size="small" onClick={() => onLoadExtras?.(c.name)}>
                    取得
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>
    </Paper>
  );
}
