"use client";

/**
 * useCsvImport
 * -----------------------------------------------------------------------------
 * CSV → SQLite 取り込みの状態管理と実行ロジックを提供するカスタムフック。
 * UIはこのフックから状態/関数を受け取り表示のみ担当（ロジック分離）。
 *
 * 【機能】
 * - ファイル選択: CSVをキューへ追加（候補テーブル名はファイル名から安全生成）
 * - 一括取り込み: キューを順次処理（済はスキップ）、完了時 onAfterImport を通知
 * - 1件取り込み: PapaParseでCSV→ inferSchemaで列型/PK/UNIQUE推定 → CREATE TABLE
 *                 1000行バッチで INSERT（各バッチをトランザクション化）
 *                 進捗 inserted/total を更新、完了/失敗を状態に反映
 * - 完了後1秒で詳細を自動で畳む（UI整理）
 *
 * 【返却API】
 * - 状態: uploads, importing, collapsed
 * - 操作: onFilesSelected, importAll, setCollapsed, clear
 * - 集計: allDone, doneCount
 */

import * as React from "react";
import Papa from "papaparse";
import { exec, listTables } from "@/lib/sqlite";
import {
  ensureUniqueTableName,
  inferSchema,
  toSqlLiteral,
  safeIdent,
  toSafeTableNameFromFile,
  type InferredCol,
} from "@/features/dashboard/lib/schema";

/**
 * 取り込み状態
 * - queued: キューに積まれた直後
 * - importing: 取り込み中（進捗更新あり）
 * - done: 成功終了
 * - error: 例外・制約違反などで失敗
 */
export type ImportStatus = "queued" | "importing" | "done" | "error";

/**
 * 1ファイル分の取り込みキュー要素
 * - candidate: 元ファイル名から生成した安全なテーブル名候補
 * - finalName: 衝突回避後の最終テーブル名
 * - inserted/total: 進捗（件数ベース）
 */
export type UploadItem = {
  file: File;
  candidate: string;
  finalName?: string;
  status: ImportStatus;
  inserted: number;
  total?: number;
  error?: string;
};

/**
 * useCsvImport
 * -----------------------------------------------------------------------------
 * CSV → SQLite 取り込みの状態管理と実行ロジックを提供するカスタムフック。
 *
 * @param onAfterImport すべての取り込みが完了した後に一度だけ呼ばれる通知コールバック
 * @returns 画面側が利用する状態/操作群
 *  - 状態: uploads, importing, collapsed
 *  - 集計: allDone, doneCount
 *  - 操作: onFilesSelected, importAll, setCollapsed, clear
 */
export function useCsvImport(onAfterImport?: () => void) {
  // 取り込みキュー（複数ファイル）
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  // 一括取り込みの実行中フラグ（ボタン無効化などに使用）
  const [importing, setImporting] = React.useState(false);
  // UIの詳細欄（取り込み履歴）を畳むかどうか
  const [collapsed, setCollapsed] = React.useState(false);

  /**
   * <input type="file" multiple> の onChange
   * 選択ファイルをキューに積み、同じファイルを連続選択できるよう input 値をリセットする
   */
  const onFilesSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;

    // ファイル名から安全なテーブル名候補を生成し、queued 状態で追加
    const newItems: UploadItem[] = Array.from(fl).map((file) => ({
      file,
      candidate: toSafeTableNameFromFile(file.name),
      status: "queued",
      inserted: 0,
    }));

    setUploads((prev) => [...prev, ...newItems]);
    setCollapsed(false); // 新規追加時は詳細を自動で展開
    e.currentTarget.value = ""; // 同じファイルを続けて選べるようにクリア
  };

  /**
   * すべてのキューを順次取り込む
   * - 既に done のものはスキップ
   * - 最後に onAfterImport を呼ぶ
   */
  async function importAll() {
    if (uploads.length === 0) return;

    setImporting(true);
    try {
      for (let i = 0; i < uploads.length; i++) {
        const it = uploads[i];
        if (it.status === "done") continue; // 再実行時の二重取り込み防止
        await importOne(i);
      }
      onAfterImport?.();
    } finally {
      setImporting(false);
    }
  }

  /**
   * キューの1件を取り込む（CSV → CREATE TABLE → INSERT バッチ）
   * 1. 最終テーブル名の確定（既存と衝突しないように調整）
   * 2. PapaParse で CSV 解析（ヘッダ/空行整形）
   * 3. inferSchema で列スキーマ/主キー/UNIQUEを推定
   * 4. CREATE TABLE（推定結果に基づきそのまま作成。自動列の付与はしない）
   * 5. INSERT を 1000行バッチ + 各バッチをトランザクション化して高速化
   * 6. 進捗 inserted を更新、完了で done／例外で error
   *
   * @param index uploads 配列中の対象インデックス
   */
  async function importOne(index: number) {
    // 1) 最終テーブル名の確定
    const cand = uploads[index].candidate || "table";
    const finalName = await ensureUniqueTableName(cand, listTables);

    // 2) CSV 解析
    const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
      Papa.parse<Record<string, string>>(uploads[index].file, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
        complete: (res) => resolve(res),
        error: (err) => reject(err),
      });
    });

    const rows = parsed.data;
    const headers = (parsed.meta.fields ?? []).filter((h): h is string => !!h && h.trim().length > 0);

    // 3) スキーマ推定
    const { cols, pk, uniqueCols } = inferSchema(rows, headers, finalName);

    const hasNaturalPK = !!pk;
    const createColsSql: string[] = [];
    for (const c of cols) {
      const parts = [`${safeIdent(c.name)} ${c.affinity}`];
      if (c.notNull) parts.push("NOT NULL");
      createColsSql.push(parts.join(" "));
    }

    const pkClause = hasNaturalPK ? `, PRIMARY KEY (${safeIdent(pk!)})` : "";
    const uniqueClauses = uniqueCols.length ? `, ${uniqueCols.map((u) => `UNIQUE (${safeIdent(u)})`).join(", ")}` : "";
    const ddl = `CREATE TABLE ${safeIdent(finalName)} (${createColsSql.join(", ")}${pkClause}${uniqueClauses})`;

    try {
      // 取り込み開始
      setUploads((prev) => {
        const cp = [...prev];
        cp[index] = { ...cp[index], status: "importing", finalName, total: rows.length, inserted: 0, error: undefined };
        return cp;
      });

      // 全体を単一トランザクションに
      await exec("BEGIN;");

      // DDL もトランザクション内（失敗すれば ROLLBACK でテーブルごと消える）
      await exec(ddl);

      const BATCH = 1000;
      const insertCols: InferredCol[] = cols;

      for (let off = 0; off < rows.length; off += BATCH) {
        const slice = rows.slice(off, Math.min(off + BATCH, rows.length));

        const values = slice
          .map((r) => {
            const literals: string[] = [];
            for (const c of cols) {
              literals.push(toSqlLiteral(r[c.name as keyof typeof r] as string | undefined, c));
            }
            return `(${literals.join(",")})`;
          })
          .join(",");

        const insertSql = `INSERT INTO ${safeIdent(finalName)} (${insertCols.map((c) => safeIdent(c.name)).join(",")}) VALUES ${values};`;
        await exec(insertSql); // ★ バッチ内で BEGIN/COMMIT はしない（上位トランザクションの中）

        // 進捗
        setUploads((prev) => {
          const cp = [...prev];
          const cur = cp[index];
          cp[index] = { ...cur, inserted: Math.min((cur.inserted ?? 0) + slice.length, rows.length) };
          return cp;
        });
      }

      // ここまで来たら確定
      await exec("COMMIT;");

      setUploads((prev) => {
        const cp = [...prev];
        cp[index] = { ...cp[index], status: "done" };
        return cp;
      });
    } catch (e) {
      // 失敗したら全取り消し
      try { await exec("ROLLBACK;"); } catch {}

      const msg = e instanceof Error ? e.message : String(e);
      setUploads((prev) => {
        const cp = [...prev];
        cp[index] = { ...cp[index], status: "error", error: msg };
        return cp;
      });
    }
  }

  // 集計（全部成功しているか／成功件数）
  const allDone = uploads.length > 0 && uploads.every((u) => u.status === "done");
  const doneCount = uploads.filter((u) => u.status === "done").length;

  /**
   * すべて完了したら、1秒後に詳細を自動で畳む（UIをすっきりさせる）
   * - 途中で状態が変わった場合のためにクリーンアップで clearTimeout
   */
  React.useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => setCollapsed(true), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [allDone]);

  return {
    // --- 状態 ---
    uploads,
    importing,
    collapsed,

    // --- 操作 ---
    setCollapsed,
    onFilesSelected,
    importAll,

    // --- 集計 ---
    allDone,
    doneCount,

    // --- 履歴クリア（UIリセット） ---
    clear: () => {
      setUploads([]);
      setCollapsed(false);
    },
  };
}
