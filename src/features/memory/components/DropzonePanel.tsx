"use client";

import * as React from "react";
import { Paper, Typography } from "@mui/material";
import { useDropzone } from "react-dropzone";

/** ドロップゾーン
 * - ファイルの読み込みロジックは持たず、選択/ドロップされた File オブジェクトを親コンポーネントに渡すだけ
 * - スタイルは MUI の theme を考慮してダーク/ライト両対応
 * - CSV と Parquet のみを受け付ける
 */
type Props = {
  busy?: boolean;                // true のとき操作を無効化し、UI上も「処理中」状態を表示
  onDropFile: (file: File) => void; // ファイルドロップ時に親へ通知するコールバック
};

export default function DropzonePanel({ busy, onDropFile }: Props) {
  // useDropzone: ファイル選択/ドロップを抽象化する便利フック
  // - multiple: false → 単一ファイルのみ受け付け
  // - accept: CSV/Parquet 拡張子のみ許可
  // - disabled: busy 時はドラッグ＆ドロップを無効化
  // - onDrop: 受け取った File[] の先頭を onDropFile に渡す
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      "text/csv": [".csv"],
      "application/octet-stream": [".parquet", ".parq"],
    },
    disabled: !!busy,
    onDrop: (files) => {
      const f = files[0];
      if (f) onDropFile(f);
    },
  });

  return (
    <Paper
      variant="outlined"
      sx={(t) => ({
        p: 3,
        mb: 2,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.palette.error.main,  // エラーカラーを基調にした枠線
        borderRadius: 2,
        textAlign: "center",
        cursor: busy ? "not-allowed" : "pointer", // busy中はカーソルで無効感を出す
        // 背景色は error.main をベースに透過度を変えて表現
        backgroundColor: t.palette.mode === "dark"
          ? "rgba(244, 67, 54, 0.6)" // ダーク時 → 赤を透過した背景
          : "rgba(244, 67, 54, 0.6)", // ライト時 → 同じく赤透過（contrastTextで文字色調整）
        // 文字色はテーマ依存で切り替え
        color: t.palette.mode === "dark"
          ? t.palette.getContrastText(t.palette.error.main) // ダークは白字
          : t.palette.grey[900],                           // ライトは黒字
        // hover時のエフェクト（busyでない場合のみ）
        "&:hover": {
          backgroundColor: busy ? undefined : "rgba(244, 67, 54, 0.7)",
          borderColor: busy ? undefined : t.palette.error.light,
        },
        // ドラッグアクティブ時の強調表示
        ...(isDragActive && {
          backgroundColor: "rgba(244, 67, 54, 1.0)",
          borderColor: t.palette.error.light,
        }),
      })}
      role="button" // アクセシビリティ: divではなくボタン的意味を持たせる
      aria-label="CSV/Parquet をアップロード" // SR向けラベル
      {...getRootProps()} // Dropzoneのイベントハンドラ/属性を注入
    >
      {/* 実際の input[type=file]。非表示だが getInputProps() によりクリックで起動 */}
      <input {...getInputProps({ multiple: false })} />
      {/* 状態に応じた文言切替 */}
      <Typography>
        {isDragActive
          ? "ここにドロップ…"   // ドラッグ中
          : busy
            ? "処理中…"         // ビジー状態
            : "CSV または Parquet をドラッグ＆ドロップ、またはクリックして選択"}
      </Typography>
    </Paper>
  );
}
