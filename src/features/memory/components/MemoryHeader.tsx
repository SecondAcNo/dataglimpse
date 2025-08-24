"use client";

import { Box, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * MemoryHeaderProps
 * ---------------------------------------------------------------------------
 * - title: 見出しテキスト（DB 名やコンテキストを示す）
 * - caption: 見出し下に表示する補足説明文
 */
export type MemoryHeaderProps = {
  title?: string;   // 見出し（省略時は "メモリDB"）
  caption?: string; // 補足説明（省略時はメモリDBの特性を説明する文言）
};

/**
 * MemoryHeader
 * ---------------------------------------------------------------------------
 * メモリDB画面のヘッダー部を構築するプレゼンテーショナルコンポーネント。
 * - h5サイズで太字のタイトルを表示
 * - タイトル下に Info アイコン付きのキャプションを横並びで表示
 * - 利用シーン: メモリDBページ先頭やカードヘッダー部分
 */
export default function MemoryHeader({
  title = "メモリDB", // デフォルト見出し
  caption = "ブラウザのメモリ上で動作する一時DBです。ブラウザを閉じたり更新すると読み込んだデータは消えます。", // デフォルト補足説明
}: MemoryHeaderProps) {
  return (
    <Box>
      {/* タイトル部分 */}
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 800 }}>
        {title}
      </Typography>

      {/* キャプション部分（アイコン＋テキストを横並び） */}
      <Box
        sx={{
          mb: 1.5,
          display: "flex",
          alignItems: "center",   // アイコンとテキストを縦中央揃え
          color: "text.secondary" // テーマに応じたセカンダリカラー
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 14, mr: 0.5 }} /> 
        <Typography variant="caption">{caption}</Typography> 
      </Box>
    </Box>
  );
}
