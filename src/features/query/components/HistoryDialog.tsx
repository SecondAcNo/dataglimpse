"use client";

import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Stack, Typography, Chip, Tooltip, Divider, IconButton, Button, Box,
} from "@mui/material";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";

/** 履歴1件分のデータ型 */
export type HistoryItem = { 
  id: string;       // 履歴の一意ID
  sql: string;      // 実行したSQL
  ts: number;       // タイムスタンプ（UNIXエポック）
  favorite: boolean;// お気に入りフラグ
};

/** コンポーネントに渡す props */
type Props = {
  open: boolean;                        // ダイアログの開閉状態
  history: HistoryItem[];               // 履歴リスト
  onClose: () => void;                  // ダイアログを閉じる
  onClearAll: () => void;               // 履歴を全削除
  onToggleFav: (id: string) => void;    // お気に入りの切り替え
  onRemove: (id: string) => void;       // 履歴削除
  onUse: (sql: string) => void;         // 選択したSQLをエディタに反映
  onRun: (sql: string) => Promise<void>;// 選択したSQLを即時実行
};

/**
 * クエリ履歴ダイアログ
 * - 過去のSQLを一覧表示
 * - お気に入り管理、再利用、即実行、削除が可能
 * - 履歴全削除もできる
 */
export default function HistoryDialog({
  open, history, onClose, onClearAll, onToggleFav, onRemove, onUse, onRun,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* ダイアログタイトル */}
      <DialogTitle>クエリ履歴</DialogTitle>

      {/* コンテンツ部 */}
      <DialogContent dividers>
        <Stack spacing={1}>
          {/* 上部ツールバー：件数表示 + 全削除 */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`件数: ${history.length}`} />
            <Box flex={1} />
            <Tooltip title="履歴を全削除">
              <IconButton onClick={onClearAll}>
                <CleaningServicesIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Divider />

          {/* 履歴一覧 */}
          <Stack spacing={1}>
            {history.map(h => (
              <Paper key={h.id} variant="outlined" sx={{ p: 1.2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {/* お気に入りトグル */}
                  <IconButton onClick={() => onToggleFav(h.id)}>
                    {h.favorite ? <StarIcon color="warning" /> : <StarBorderIcon />}
                  </IconButton>

                  {/* SQLテキスト表示（等幅フォントで折り返しあり） */}
                  <Typography sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", flex: 1 }}>
                    {h.sql}
                  </Typography>

                  {/* アクションボタン群 */}
                  <Button size="small" onClick={() => { onUse(h.sql); onClose(); }}>編集に反映</Button>
                  <Button size="small" variant="contained" onClick={() => onRun(h.sql)}>実行</Button>
                  <Button size="small" color="error" onClick={() => onRemove(h.id)}>削除</Button>
                </Stack>

                {/* 実行日時 + お気に入りラベル */}
                <Typography variant="caption" color="text.secondary">
                  {new Date(h.ts).toLocaleString()} 
                  {h.favorite && <Chip label="★ お気に入り" size="small" sx={{ ml: 1 }} />}
                </Typography>
              </Paper>
            ))}

            {/* 履歴が空の場合のメッセージ */}
            {history.length === 0 && <Typography color="text.secondary">履歴はまだありません。</Typography>}
          </Stack>
        </Stack>
      </DialogContent>

      {/* 下部の閉じるボタン */}
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
