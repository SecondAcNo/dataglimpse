"use client";

import { useCallback, useState } from "react";
import {
  copyToParquetMemfs,
  verifyParquetCount,
  downloadMemfsFile,
} from "@/lib/duck";
import { niceStamp } from "@/features/memory/utils/parquet";
import type {
  ExecState,
  ExportSource,
  ParquetCodec,
} from "@/features/memory/types/memory";

/**
 * useParquetExport
 * DuckDB → Parquet 変換＋ダウンロード用フック
 * - 出力は MEMFS のルート直下（'/xxx.parquet'）。/tmp は使わない（環境により存在しない）
 * - SQL 末尾のセミコロンは除去（COPY のサブクエリで邪魔）
 * - ZSTD 失敗時は SNAPPY に自動フォールバック
 * - 変換後に read_parquet で検証してからダウンロード（0KB対策）
 * - ダウンロードは MEMFS → Blob 直変換（VFS キャッシュに依存しない）
 */
export default function useParquetExport(
  setExec: React.Dispatch<React.SetStateAction<ExecState>>
) {
  const [parquetBusy, setParquetBusy] = useState(false);
  const [parquetProgress, setParquetProgress] = useState<number>(0);
  const [exportSource, setExportSource] = useState<ExportSource>("table");
  // 安定性重視で既定は SNAPPY（ZSTD は環境差で失敗しやすいケースあり）
  const [parquetCodec, setParquetCodec] = useState<ParquetCodec>("snappy");

  const doParquet = useCallback(
    async (params: { sql: string; hasTable: boolean; currentTable: string }) => {
      const { sql, hasTable, currentTable } = params;

      // 1) エクスポート対象に応じて SELECT を決定（末尾 ; は除去）
      let selectSql: string;
      let nameBase: string;

      if (exportSource === "sql") {
        const s = sql.trim().replace(/;+\s*$/, "");
        if (!s) {
          setExec({
            status: "SQLが空です。SQLタブに条件を書いてください。",
            execMs: null,
          });
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

      // 2) 変換実行
      setParquetBusy(true);
      setParquetProgress(0);
      const t0 = performance.now();

      const fileBase = `${nameBase}_${niceStamp()}`;
      const memPath = `/${fileBase}.parquet` as `/${string}`;
      const downloadName = `${fileBase}.parquet`;

      try {
        setExec({
          status: `Parquet 変換中（${parquetCodec.toUpperCase()}）…`,
          execMs: null,
        });

        try {
          await copyToParquetMemfs(selectSql, memPath, parquetCodec);
        } catch (err) {
          // ZSTD で落ちる環境用フォールバック
          if (parquetCodec === "zstd") {
            await copyToParquetMemfs(selectSql, memPath, "snappy");
            setExec({
              status: "ZSTDで失敗 → SNAPPYで再実行しました。",
              execMs: null,
            });
          } else {
            throw err;
          }
        }
        setParquetProgress(40);

        // 3) 直後に read_parquet で検証（ここが通れば 0KB ではない）
        const rowCount = await verifyParquetCount(memPath);
        setParquetProgress(60);

        // 4) MEMFS → ブラウザへ即ダウンロード（VFS キャッシュに依存しない）
        await downloadMemfsFile(
          memPath,
          downloadName,
          "application/x-parquet",
          true // ダウンロード後は MEMFS から削除
        );
        setParquetProgress(100);

        const t1 = performance.now();
        setExec({
          status: `Parquet 保存完了：${downloadName}（行数: ${rowCount}）`,
          execMs: Math.round(t1 - t0),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setExec({ status: `Parquet 変換/保存エラー：${msg}`, execMs: null });
      } finally {
        setParquetBusy(false);
        setParquetProgress(0);
      }
    },
    [exportSource, parquetCodec, setExec]
  );

  return {
    parquetBusy,
    parquetProgress,
    exportSource,
    setExportSource,
    parquetCodec,
    setParquetCodec,
    doParquet,
  };
}
