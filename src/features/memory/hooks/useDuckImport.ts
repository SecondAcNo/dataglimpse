"use client";

import { useCallback } from "react";
import {
  registerFile,
  createTableFromCSV,
  createTableFromParquet,
} from "@/lib/duck";
import type { ExecState } from "@/features/memory/types/memory";

/**
 * useDuckImport
 * =============================================================================
 * Hook: ファイル取り込み機能（CSV / Parquet対応）
 *
 * 主な流れ:
 *   1. Fileオブジェクトを Uint8Array に変換
 *   2. 仮想ファイルシステム (DuckDB WASM VFS) に登録
 *   3. 拡張子を判定して createTableFromCSV / createTableFromParquet を呼ぶ
 *   4. reloadTables により DB 内テーブル一覧を再取得
 *   5. 新規テーブルを対象とした初期 SQL (SELECT * ...) をセット
 *   6. ステータス更新で UI に進捗やエラーを反映
 *
 * 注意点:
 * - ready=false の場合は DB 初期化未完了として処理を中断
 * - ファイル名からテーブル名を生成するが、非英数字は "_" に置換
 * - ダブルクォートを含む名前は SQL Injection 対策としてエスケープ
 */
export default function useDuckImport(params: {
  ready: boolean; // DuckDB の初期化完了フラグ
  setExec: React.Dispatch<React.SetStateAction<ExecState>>; // 実行状態の更新関数
  reloadTables: (preferTable?: string) => Promise<string[]>; // テーブル一覧再取得
  setSql: React.Dispatch<React.SetStateAction<string>>;      // SQL エディタ内容更新
}) {
  const { ready, setExec, reloadTables, setSql } = params;

  /**
   * onDropFile
   * -----------------------------------------------------------------------------
   * DnD または input[type=file] で受け取った File を処理。
   * 非同期処理内で進捗・成功・失敗のステータスを UI に反映。
   */
  const onDropFile = useCallback(
    async (file: File) => {
      if (!ready) {
        // DuckDB がまだ初期化されていない場合の早期リターン
        setExec({
          status: "DB準備中です。少し待ってから再試行してください。",
          execMs: null,
        });
        return;
      }

      // ステータス更新: 読み込み開始
      setExec({ status: `読み込み中: ${file.name}`, execMs: null });

      try {
        // --- 1. バイナリ変換 ---
        const buf = new Uint8Array(await file.arrayBuffer());

        // --- 2. テーブル名決定 ---
        const raw = file.name.replace(/\.[^.]+$/, "");         // 拡張子除去
        const tbl = raw.replace(/[^A-Za-z0-9_]/g, "_") || "mytable"; // 非英数字→_

        // --- 3. 仮想ファイルシステム登録 ---
        const virtPath = `/${file.name}` as `/${string}`;
        await registerFile(virtPath, buf);

        // --- 4. 拡張子で分岐してテーブル作成 ---
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".parquet") || lower.endsWith(".parq")) {
          await createTableFromParquet(tbl, virtPath);
        } else {
          await createTableFromCSV(tbl, virtPath);
        }

        // --- 5. テーブル一覧更新 ---
        await reloadTables(tbl);

        // --- 6. 初期SQLをセット ---
        setSql(`SELECT * FROM "${tbl.replace(/"/g, '""')}"`);

        // ステータス更新: 完了
        setExec({
          status: `読み込み完了: ${file.name} → テーブル '${tbl}'`,
          execMs: null,
        });
      } catch (e: unknown) {
        // エラー発生時はユーザにメッセージ表示
        const msg = e instanceof Error ? e.message : String(e);
        setExec({ status: `読み込みエラー: ${msg}`, execMs: null });
      }
    },
    [ready, setExec, reloadTables, setSql]
  );

  return { onDropFile };
}
