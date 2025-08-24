"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  Paper, Typography, Stack, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Divider,
  Button, Chip, Snackbar
} from "@mui/material";
import { inferColumns, InferredColumn } from "@/lib/csvUtils";
import { importCsv, saveNow, listTables, isPersistent } from "@/lib/sqlite";
import { useRouter } from "next/navigation";

type Row = Record<string, unknown>;

// タイムアウトユーティリティ
function withTimeout<T>(p: Promise<T>, ms: number, label = "処理"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label}がタイムアウトしました（${ms}ms）`)), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

/** ファイル名から安全なテーブル名候補を作る（小文字, 記号→_ , 先頭は英字/_, 長さ<=63） */
function toSafeTableNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  let s = base.normalize("NFKD").replace(/[^\w]+/g, "_");
  s = s.replace(/^[^A-Za-z_]+/, "");
  if (s.length === 0) s = "table";
  if (s.length > 63) s = s.slice(0, 63);
  return s.toLowerCase();
}

/** 既存テーブルと重複しない名前に調整（_2, _3, ... を付与） */
async function ensureUniqueTableNameSqlite(base: string): Promise<string> {
  const existing = new Set(await listTables());
  if (!existing.has(base)) return base;
  let n = 2;
  // 衝突しなくなるまでサフィックスを増やす
  // 例: users -> users_2 -> users_3 ...
  while (existing.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** CSV を全行パースする（プレビューではない） */
function parseCsvAll(file: File): Promise<Row[]> {
  return new Promise<Row[]>((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        resolve(result.data as Row[]);
      },
      error: (e) => reject(e),
    });
  });
}

// セル表示のユーティリティ
function toCell(v: unknown) {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function UploadArea() {
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [schema, setSchema] = React.useState<InferredColumn[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileObj, setFileObj] = React.useState<File | null>(null);

  // ページング
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  // 取り込みの進捗／通知
  const [importing, setImporting] = React.useState(false);
  const [snack, setSnack] = React.useState<string | null>(null);

  // テーブル名（候補）と、実際に作成された最終名
  const [tableCandidate, setTableCandidate] = React.useState<string | null>(null);
  const [importedTable, setImportedTable] = React.useState<string | null>(null);

  const router = useRouter();

  // DnDでCSV受け取り → 200行プレビュー＆型推定
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles?.[0];
    if (!file) return;

    setError(null);
    setFileObj(file);
    setFileName(file.name);
    setHeaders([]);
    setRows([]);
    setSchema(null);
    setPage(0);
    setImportedTable(null);

    setTableCandidate(toSafeTableNameFromFile(file.name));

    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      preview: 200,
      complete: (result) => {
        const fields =
          (result.meta?.fields as string[] | undefined) ??
          (result.data[0] ? Object.keys(result.data[0]) : []);
        setHeaders(fields);
        const data = result.data as Row[];
        setRows(data);
        const inferred = inferColumns(data, fields);
        setSchema(inferred);
      },
      error: (e) => setError(e.message),
    });
  }, []);

  // Dropzone設定（クリックはボタンから）
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  // ページング
  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // 現在ページの表示用スライス
  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, page, rowsPerPage]);

  // SQLite 取り込み
  const handleImport = async () => {
    if (!schema || headers.length === 0 || !fileObj) return;

    try {
      setImporting(true);

      // 1) 全行パース（プレビューではなくフル）
      const allRows = await withTimeout(parseCsvAll(fileObj), 60_000, "CSVの全行読み込み");
      if (allRows.length === 0) {
        setError("CSVにデータがありません。");
        return;
      }

      // 2) テーブル名ユニーク化
      const base = (tableCandidate ?? "uploaded").toLowerCase();
      const finalName = await ensureUniqueTableNameSqlite(base);

      // 3) SQLite へ投入（TEXTで作成→INSERT）。保存は最後に一度だけ
      await withTimeout(importCsv(finalName, allRows), 90_000, "SQLiteへの取り込み");
      await withTimeout(saveNow(), 10_000, "保存");

      setImportedTable(finalName);
      setSnack(
        `${isPersistent() ? "SQLite(IndexedDB) に保存しました" : "メモリ動作（ブラウザを閉じると消えます）"}：` +
        `テーブル "${finalName}" を作成しました。`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`${msg}\n（CSVの文字コード/ヘッダー行や、ブラウザのストレージ制限も確認してください）`);
    } finally {
      setImporting(false);
    }
  };

  // クエリ画面へ（作成済みテーブル名を使う）
  const goQuery = () => {
    if (!importedTable) {
      setError("まだ取り込みが完了していません。先に「SQLiteに取り込み」を実行してください。");
      return;
    }
    const sql = `SELECT * FROM "${importedTable}" LIMIT 100`;
    router.push(`/query?sql=${encodeURIComponent(sql)}`);
  };

  return (
    <Stack spacing={2}>
      {/* アップロードエリア */}
      <Paper variant="outlined" sx={{ p: 4 }} {...getRootProps()}>
        <input {...getInputProps()} />
        <Stack spacing={1} alignItems="center" textAlign="center">
          <Typography variant="h5" fontWeight={700}>CSVをドラッグ＆ドロップ</Typography>
          <Typography variant="body2">
            または
            <Button onClick={open} sx={{ ml: 1 }} variant="contained">ファイルを選択</Button>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            先頭200行をプレビューします（UTF-8想定）
          </Typography>
          {isDragActive && (
            <Alert severity="info" sx={{ mt: 2, width: "100%" }}>
              ここにドロップして読み込み
            </Alert>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {/* 推定スキーマ */}
      {schema && schema.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack>
              <Typography variant="h6">推定スキーマ</Typography>
              <Typography variant="caption" color="text.secondary">
                作成予定テーブル名：{tableCandidate ?? "(未決定)"}（重複があれば自動で _2, _3 … を付与）
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                disabled={!schema || !fileObj || importing}
                onClick={handleImport}
              >
                {importing ? "取り込み中..." : "SQLiteに取り込み"}
              </Button>
              <Button variant="contained" disabled={importing || !importedTable} onClick={goQuery}>
                クエリで開く
              </Button>
            </Stack>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>列名</TableCell>
                  <TableCell>型</TableCell>
                  <TableCell>欠損率</TableCell>
                  <TableCell>候補キー</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schema.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>{(c.nullRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>{c.unique ? <Chip size="small" label="一意" /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* プレビュー */}
      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">プレビュー</Typography>
            <Typography variant="body2" color="text.secondary">{fileName}</Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {headers.map((h) => (<TableCell key={h}>{h}</TableCell>))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((r, idx) => (
                  <TableRow key={idx} hover>
                    {headers.map((h) => (<TableCell key={h}>{toCell(r[h])}</TableCell>))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        message={snack ?? ""}
        autoHideDuration={3000}
      />
    </Stack>
  );
}
