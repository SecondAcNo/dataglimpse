"use client";

/**
 * CsvImportPanel
 * CSVの一括取り込みUI。ファイル選択→キュー→進捗表示→完了/失敗を管理。
 * - ロジックは useCsvImport に委譲（imp.* を参照）
 * - 「取り込み開始」はファイルが無い/実行中は無効
 * - 詳細は折りたたみ可能、履歴クリア可（実行中は無効）
 * - onAfterImport: 取り込み完了後に親へ通知したい場合に使用
 * - hasAnyTable: 既にDBにテーブルが1つ以上あるか（未指定でも取り込み完了で強調は自動OFF）
 * - 追加: すべて完了後に履歴自動クリア。失敗があれば ConfirmDialog で通知。
 */

import * as React from "react";
import {
  Paper, Stack, Button, Chip, LinearProgress, Typography, Collapse, Divider
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { useCsvImport } from "@/features/dashboard/hooks/useCsvImport";
import ConfirmDialog from "@/components/common/ConfirmDialog";

type Props = {
  onAfterImport?: () => void;   // 取り込み後に親へ知らせたい時の任意コールバック
  hasAnyTable?: boolean;        // 既にDBにテーブルが存在するか（任意）
};

export default function CsvImportPanel({ onAfterImport, hasAnyTable }: Props) {
  const imp = useCsvImport(onAfterImport);

  // このパネル内で1件でも完了していれば「読み込めた」とみなす
  const hasImportedHere = React.useMemo(
    () => imp.uploads.some(u => u.status === "done"),
    [imp.uploads]
  );

  // 強調表示（未読込時のみ淡い赤グラデーション）
  const emphasize = (hasAnyTable === undefined ? true : !hasAnyTable) && !hasImportedHere;

  // ===== 完了後の自動処理（失敗表示 → 履歴クリア） =====
  const wasImportingRef = React.useRef<boolean>(imp.importing);
  const [failDialogOpen, setFailDialogOpen] = React.useState(false);

  // 失敗アイテム一覧（名前とエラー文）
  const failedItems = React.useMemo(
    () => imp.uploads.filter(u => u.status === "error" || !!u.error),
    [imp.uploads]
  );

  React.useEffect(() => {
    const was = wasImportingRef.current;
    const now = imp.importing;
    wasImportingRef.current = now;

    // 実行中 → 終了 に遷移したタイミングで判定
    if (was && !now) {
      if (failedItems.length > 0) {
        // 失敗があればダイアログで通知（OK後にクリア）
        setFailDialogOpen(true);
      } else {
        // 全件成功なら即クリア
        imp.clear();
      }
    }
  }, [imp.importing, failedItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseFailDialog = () => {
    setFailDialogOpen(false);
    // ダイアログを閉じたら履歴クリア
    imp.clear();
  };

  return (
    <Paper
      variant="outlined"
      sx={(t) => ({
        p: 2,
        mb: 2,
        backgroundImage: emphasize
          ? `linear-gradient(135deg,
              ${alpha(t.palette.error.light, 0.10)} 0%,
              ${alpha(t.palette.error.light, 0.04)} 100%)`
          : "none",
        borderColor: emphasize ? alpha(t.palette.error.main, 0.35) : undefined,
        boxShadow: emphasize ? `0 0 0 1px ${alpha(t.palette.error.main, 0.10)} inset` : "none",
        transition: t.transitions.create(
          ["background-image", "border-color", "box-shadow"],
          { duration: t.transitions.duration.shorter }
        ),
      })}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <Stack flex={1}>
          <Typography variant="h6" fontWeight={700}>
            CSV一括取り込み
            {emphasize && (
              <Chip
                size="small"
                color="error"
                label="まずは取り込みを開始してください"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            複数CSVを選択 → 列型/主キー/UNIQUEを自動推定して取り込みます
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component="label" startIcon={<UploadFile />}>
            CSVを選択
            <input type="file" accept=".csv,text/csv" multiple hidden onChange={imp.onFilesSelected} />
          </Button>
          <Button
            variant="contained"
            onClick={imp.importAll}
            disabled={imp.uploads.length === 0 || imp.importing}
          >
            {imp.importing ? "取り込み中…" : "取り込み開始"}
          </Button>
        </Stack>
      </Stack>

      {imp.uploads.length > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 1.5, gap: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            {imp.allDone ? `取り込みが完了しました（${imp.doneCount} 件）` : `キュー ${imp.uploads.length} 件`}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => imp.setCollapsed((c) => !c)}>
              {imp.collapsed ? "詳細を表示" : "折りたたむ"}
            </Button>
            <Button size="small" variant="outlined" onClick={imp.clear} disabled={imp.importing}>
              履歴をクリア
            </Button>
          </Stack>
        </Stack>
      )}

      <Collapse in={!imp.collapsed} sx={{ mt: imp.uploads.length > 0 ? 1 : 0 }}>
        {imp.uploads.length > 0 && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {imp.uploads.map((u, idx) => (
                <Paper key={`${u.file.name}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">
                        {u.file.name} → <strong>{u.finalName ?? u.candidate}</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.total
                          ? `${u.inserted}/${u.total} 行`
                          : (u.status === "queued" ? "待機中" : `${u.inserted} 行`)
                        }
                      </Typography>
                    </Stack>
                    <Chip
                      size="small"
                      label={
                        u.status === "queued"
                          ? "待機"
                          : u.status === "importing"
                          ? "取り込み中"
                          : u.status === "done"
                          ? "完了"
                          : "失敗"
                      }
                      color={
                        u.status === "queued"
                          ? "default"
                          : u.status === "importing"
                          ? "info"
                          : u.status === "done"
                          ? "success"
                          : "error"
                      }
                    />
                  </Stack>
                  <LinearProgress
                    variant={u.total ? "determinate" : "indeterminate"}
                    value={u.total ? Math.min(100, (u.inserted / u.total) * 100) : undefined}
                    sx={{ mt: 1 }}
                  />
                  {u.error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                      {u.error}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </>
        )}
      </Collapse>

      {/* 失敗通知ダイアログ（OK で履歴クリア） */}
      <ConfirmDialog
        open={failDialogOpen}
        title="一部のCSVの取り込みに失敗しました"
        message={
          <Stack spacing={1} sx={{ mt: 1 }}>
            {failedItems.map((u, i) => (
              <Typography key={`${u.file.name}-${i}`} variant="body2">
                <strong>{u.file.name}</strong>
                {u.error ? `：${u.error}` : ""}
              </Typography>
            ))}
          </Stack>
        }
        onClose={handleCloseFailDialog}
        onConfirm={handleCloseFailDialog}
        confirmColor="error"
        disableConfirm={true}
      />
    </Paper>
  );
}
