"use client";
/**
 * ColumnEditorDialog.tsx（any禁止・型安全版）
 * -------------------------------------------------------
 * 目的:
 *  - 自動推定（例: uniqueNoNull / isPk）に対して、ユーザーが手動で PK / Unique を上書き
 *  - ColumnMeta に isUnique / isPk が無くても安全に動作（存在すれば使い、無ければ既存の自動推定へフォールバック）
 *
 * ポイント:
 *  - any 完全不使用
 *  - オプショナルな boolean プロパティを安全に読むヘルパ関数を用意（存在しなければ undefined）
 *  - 優先順位: overrides ＞ 自動推定
 */

import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  Stack,
  Typography,
} from "@mui/material";

import type { TableMeta } from "@/lib/erApply";
import type { Overrides } from "@/lib/erOverrides";
import { setColumnOverride, clearTableOverrides } from "@/lib/erOverrides";

/** オーバーライド対象キー */
type OverrideKey = "isPk" | "isUnique";

/** Props */
type Props = {
  open: boolean;
  onClose: () => void;
  table: TableMeta | null;
  overrides: Overrides;
  onChange: (next: Overrides) => void;
};

/**
 * 任意オブジェクトから、指定キー（boolean想定）の値を安全に取得。
 * - そのキーが存在し boolean ならその値、そうでなければ undefined を返す。
 * - any は使わず、Record<string, unknown> で厳密化。
 */
function getOptionalBoolean(obj: unknown, key: string): boolean | undefined {
  if (obj !== null && typeof obj === "object" && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "boolean" ? v : undefined;
  }
  return undefined;
}

/**
 * 実効フラグ（isPk / isUnique）を算出
 * 優先順位: overrides ＞ autoPk/autoUnique（無ければ false 扱い）
 */
function getEffectiveFlags(
  tableName: string,
  columnName: string,
  overrides: Overrides,
  autoPk: boolean | undefined,
  autoUnique: boolean | undefined
): { isPk: boolean; isUnique: boolean } {
  const tOv = overrides[tableName] ?? {};
  const cOv = tOv[columnName] ?? {};

  const isPk =
    typeof cOv.isPk === "boolean" ? cOv.isPk : Boolean(autoPk);
  const isUnique =
    typeof cOv.isUnique === "boolean" ? cOv.isUnique : Boolean(autoUnique);

  return { isPk, isUnique };
}

/**
 * 指定列の override をトグル更新
 * （undefined/false → true, true → false）
 */
function toggleOverride(
  overrides: Overrides,
  tableName: string,
  columnName: string,
  key: OverrideKey
): Overrides {
  const tOv = overrides[tableName] ?? {};
  const currentUnknown = tOv[columnName]?.[key];
  const current =
    typeof currentUnknown === "boolean" ? currentUnknown : false;
  const nextVal = !current;
  return setColumnOverride(overrides, tableName, columnName, { [key]: nextVal });
}

export default function ColumnEditorDialog({
  open,
  onClose,
  table,
  overrides,
  onChange,
}: Props) {
  if (!table) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="column-editor-title">
      <DialogTitle id="column-editor-title">
        {table.name} の列定義を編集
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          チェックで <strong>PK</strong> / <strong>Unique</strong> を手動指定できます（自動推定を上書き）。
        </Typography>

        <Table size="small" sx={{ mt: 1 }} aria-label={`${table.name} columns`}>
          <TableHead>
            <TableRow>
              <TableCell>列名</TableCell>
              <TableCell>型</TableCell>
              <TableCell align="center">PK</TableCell>
              <TableCell align="center">Unique</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {table.columns.map((col) => {
              const autoPk: boolean | undefined = getOptionalBoolean(col, "isPk");
              const autoUnique: boolean | undefined =
                getOptionalBoolean(col, "isUnique") ?? col.uniqueNoNull;

              const effective = getEffectiveFlags(
                table.name,
                col.name,
                overrides,
                autoPk,
                autoUnique
              );

              const onTogglePk = () => {
                onChange(toggleOverride(overrides, table.name, col.name, "isPk"));
              };
              const onToggleUnique = () => {
                onChange(toggleOverride(overrides, table.name, col.name, "isUnique"));
              };

              return (
                <TableRow key={col.name} hover>
                  <TableCell component="th" scope="row">
                    {col.name}
                  </TableCell>
                  <TableCell>{col.dataType}</TableCell>
                  <TableCell align="center">
                    <Checkbox
                      inputProps={{ "aria-label": `${col.name} is PK` }}
                      checked={effective.isPk}
                      onChange={onTogglePk}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      inputProps={{ "aria-label": `${col.name} is Unique` }}
                      checked={effective.isUnique}
                      onChange={onToggleUnique}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ mr: "auto", pl: 2 }}>
          <Button
            onClick={() => onChange(clearTableOverrides(overrides, table.name))}
            color="warning"
            variant="outlined"
          >
            このテーブルの手動設定をクリア
          </Button>
        </Stack>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
