"use client";

import { useCallback, useState } from "react";
import { copyToCsvMemfs, downloadMemfsFile } from "@/lib/duck";
import { niceStamp, } from "@/features/memory/utils/parquet";
import type { ExecState, ExportSource } from "@/features/memory/types/memory";

/**
 * CSV エクスポート用フック
 * - exportSource が "table" か "sql" かに応じて SELECT 文を組み立て
 * - DuckDB の COPY を使って memfs へ CSV を出力
 * - memfs → ファイル保存ダイアログへストリーム
 */
export default function useCsvExport(
  setExec: React.Dispatch<React.SetStateAction<ExecState>>
) {
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0); // 進捗が不要なら消してOK

  const doCsv = useCallback(async ({
    sql, hasTable, currentTable, exportSource,
  }: {
    sql: string; hasTable: boolean; currentTable: string; exportSource: ExportSource;
  }) => {
    let selectSql: string;
    let nameBase: string;

    if (exportSource === "sql") {
      const s = sql.trim();
      if (!s) {
        setExec({ status: "SQLが空です。SQLタブに条件を書いてください。", execMs: null });
        return;
      }
      selectSql = s;
      nameBase = "query";
    } else {
      if (!hasTable) {
        setExec({ status: "テーブル未選択です。", execMs: null });
        return;
      }
      const tbl = currentTable.replace(/"/g, '""');
      selectSql = `SELECT * FROM "${tbl}"`;
      nameBase = currentTable;
    }

    setCsvBusy(true);
    setCsvProgress(0);
    const t0 = performance.now();

    const stamp = niceStamp();
    const base = `${nameBase}_${stamp}`;
    const memPath = `/tmp/${base}.csv` as `/${string}`;
    const filename = `${base}.csv`;

    try {
      await copyToCsvMemfs(selectSql, memPath, true);
      await downloadMemfsFile(memPath, filename, "text/csv;charset=utf-8");

      setExec({ status: `CSV 保存完了：${filename}`, execMs: Math.round(performance.now() - t0) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExec({ status: `CSV 変換/保存エラー：${msg}`, execMs: null });
    } finally {
      setCsvBusy(false);
      setCsvProgress(0);
    }
  }, [setExec]);

  return { csvBusy, csvProgress, doCsv };
}
