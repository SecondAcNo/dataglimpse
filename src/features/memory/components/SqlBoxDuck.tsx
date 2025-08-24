"use client";

import * as React from "react";
import Editor from "@uiw/react-codemirror";
import { sql as cmSql } from "@codemirror/lang-sql";
import { autocompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { format } from "sql-formatter";
import { Box, Stack, Button, Tooltip, IconButton, useTheme } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// CodeMirror テーマ
import { oneDark } from "@codemirror/theme-one-dark";

/**
 * SchemaDict
 * -----------------------------------------------------------------------------
 * DBスキーマ情報を格納する型。
 * - key: テーブル名
 * - value: カラム名の配列
 *
 * 例:
 * {
 *   users: ["id", "name", "email"],
 *   orders: ["id", "user_id", "amount"]
 * }
 */
export type SchemaDict = Record<string, string[]>;

type Props = {
  /** SQLエディタ内のテキスト値 */
  value: string;
  /** 値が変更されたときに親へ通知するコールバック */
  onChange: (v: string) => void;
  /** 「実行」ボタン押下時に呼ばれるコールバック */
  onRun: () => void;
  /** 実行中かどうかを示すフラグ（ボタン制御に利用） */
  loading: boolean;
  /** 補完候補生成の元になるスキーマ情報 */
  schema: SchemaDict; // { tableName: [colA, colB, ...] }
};

/**
 * SqlBoxDuck
 * -----------------------------------------------------------------------------
 * SQL入力専用のエディタコンポーネント。
 *
 * その他:
 * - CodeMirror ベースのSQLエディタ（@uiw/react-codemirror）
 * - SQLキーワード・テーブル名・カラム名のオートコンプリート対応
 * - SQL文の整形（sql-formatter）
 * - SQL文のクリップボードコピー
 * - ダーク/ライトテーマ自動切替（MUIテーマに同期）
 */
export default function SqlBoxDuck({ value, onChange, onRun, loading, schema }: Props) {
  const theme = useTheme();

  // --- SQL補完機能の定義 ------------------------------------------------------
  const completion = React.useCallback((ctx: CompletionContext) => {
    const word = ctx.matchBefore(/[\w".]+/);
    if (!word && !ctx.explicit) return null;

    const items: Completion[] = [];

    // SQLキーワード補完
    const KEYWORDS = [
      "SELECT","FROM","WHERE","GROUP","BY","ORDER","LIMIT","JOIN","LEFT","RIGHT","FULL","OUTER",
      "ON","USING","UNION","ALL","DISTINCT","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
      "CREATE","TABLE","VIEW","REPLACE","DROP","ALTER","ADD","PRIMARY","KEY","NOT","NULL",
      "AS","AND","OR","IN","BETWEEN","LIKE","IS","HAVING","CASE","WHEN","THEN","ELSE","END",
      "CAST","EXTRACT","DATE","TIME","TIMESTAMP","CURRENT_DATE","CURRENT_TIMESTAMP"
    ] as const;
    for (const kw of KEYWORDS) items.push({ label: kw, type: "keyword", apply: kw });

    // スキーマ補完（テーブル名 + カラム名）
    const tableNames = Object.keys(schema);
    for (const t of tableNames) {
      const tEsc = `"${t.replace(/"/g, '""')}"`;
      items.push({ label: t, type: "class", apply: tEsc }); // テーブル名
      for (const c of schema[t]) {
        const cEsc = `"${c.replace(/"/g, '""')}"`;
        // fully qualified name (t.c)
        items.push({ label: `${t}.${c}`, type: "property", apply: `${tEsc}.${cEsc}` });
        // 単独カラム名
        items.push({ label: c, type: "property", apply: cEsc });
      }
    }

    return { from: word ? word.from : ctx.pos, options: items, validFor: /[\w".]+/ };
  }, [schema]);

  // --- CodeMirror拡張（SQL構文 + 補完 + テーマ切替） ------------------------
  const extensions = React.useMemo(() => {
    const exts = [cmSql(), autocompletion({ override: [completion] })];
    if (theme.palette.mode === "dark") exts.push(oneDark);
    return exts;
  }, [completion, theme.palette.mode]);

  // --- ハンドラ群 ------------------------------------------------------------
  const handleChange = (next: string) => onChange(next ?? "");

  /** SQLを自動整形（キーワード大文字化, インデント調整） */
  const handleFormat = () => {
    try {
      const out = format(value, { language: "sql", keywordCase: "upper" });
      if (out && out !== value) onChange(out);
    } catch { /* 整形失敗時は無視 */ }
  };

  /** SQLをクリップボードにコピー */
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* 失敗は握りつぶす */ }
  };

  // --- Render ---------------------------------------------------------------
  return (
    <Stack spacing={1}>
      {/* エディタ部分 */}
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
        <Editor
          value={value}
          height="220px"
          onChange={handleChange}
          extensions={extensions}
          theme={theme.palette.mode === "dark" ? "dark" : "light"} 
          basicSetup={{ lineNumbers: true, autocompletion: true, foldGutter: true }}
        />
      </Box>

      {/* アクションボタン群 */}
      <Stack direction="row" spacing={1} alignItems="center">
        {/* 実行ボタン */}
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={onRun}
          disabled={loading || value.trim().length === 0}
        >
          {loading ? "実行中..." : "実行"}
        </Button>

        {/* 整形ボタン */}
        <Button variant="outlined" startIcon={<FormatAlignLeftIcon />} onClick={handleFormat} disabled={loading}>
          整形
        </Button>

        {/* コピーアイコン */}
        <Tooltip title="SQLをコピー">
          <span><IconButton onClick={handleCopy}><ContentCopyIcon /></IconButton></span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
