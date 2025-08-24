"use client";

import { getDuckVFS, readMemFile } from "@/lib/duck";
import type { DuckVFS } from "@/features/memory/types/memory";

/** 
 * 現在時刻を yyyymmdd_HHMM 形式のタイムスタンプ文字列に変換するユーティリティ
 * 例: 20250822_1735
 * - ファイル保存時のデフォルト名などに利用する想定
 */
export const niceStamp = (): string => {
  const dt = new Date();
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(
    dt.getDate()
  ).padStart(2, "0")}_${String(dt.getHours()).padStart(2, "0")}${String(
    dt.getMinutes()
  ).padStart(2, "0")}`;
};

/**
 * MEMFS (DuckDB の仮想ファイルシステム) にあるファイルを
 * ユーザー環境に保存するための共通関数。
 * 
 * 1. ブラウザが `showSaveFilePicker` API に対応している場合:
 *    - File System Access API を用い、ストリーム書き出しを行う
 *    - 大容量ファイルでもメモリに載せず効率的に書き込める
 *    - 書き込み途中の進捗をコールバックで通知可能
 * 
 * 2. 非対応ブラウザの場合:
 *    - MEMFS のファイルをメモリ上に読み出して Blob を生成
 *    - `a[href=blob]` のクリックによりダウンロードをトリガー
 *    - ただし大容量ファイルではメモリ負荷が大きくなる点に注意
 * 
 * @param memPath MEMFS 上のファイルパス（例: "/tmp/foo.parquet"）
 * @param downloadName 保存時にユーザーに提示するデフォルトのファイル名
 * @param opts.onProgress 進捗をパーセンテージ (0–100) で通知するコールバック（任意）
 */
export const streamMemfsFileToPicker = async (
  memPath: `/${string}`,
  downloadName: string,
  opts?: { onProgress?: (pct: number) => void }
) => {
  const onProgress = opts?.onProgress;
  const vfs: DuckVFS = getDuckVFS();
  const sizeFromStat = vfs.stat(memPath).size;

  // File System Access API 経由での保存（モダンブラウザ向け）
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept?: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Uint8Array) => Promise<void>;
        close: () => Promise<void>;
        abort?: () => Promise<void>;
      }>;
    }>;
  };

  if (w.showSaveFilePicker) {
    // --- 保存用ダイアログを開く ---
    const handle = await w.showSaveFilePicker({
      suggestedName: downloadName,
      types: [{ description: "Parquet", accept: { "application/octet-stream": [".parquet"] } }],
    });
    const writable = await handle.createWritable();

    const size = sizeFromStat;
    const fd = vfs.open(memPath, "r");
    const chunkSize = 32 * 1024 * 1024; // 読み込みチャンクサイズ: 32MB
    const buf = new Uint8Array(chunkSize);
    let offset = 0;

    try {
      // --- チャンク単位で読み込み & 書き込み ---
      while (true) {
        const toRead = size > 0 ? Math.min(chunkSize, size - offset) : chunkSize;
        const n = vfs.read(fd, buf, 0, toRead, offset);
        if (n <= 0) break; // EOF
        await writable.write(n === buf.length ? buf : buf.subarray(0, n));
        offset += n;

        // 進捗コールバック
        if (size > 0 && onProgress) onProgress(Math.floor((offset / size) * 100));
      }
      await writable.close();
      return;
    } catch (e) {
      // 途中でエラーが発生した場合、FileWriter を abort
      try {
        await (writable as { abort?: () => Promise<void> }).abort?.();
      } catch {
        /* noop */
      }
      throw e;
    } finally {
      // リソース解放 & MEMFS から削除（必要に応じて）
      vfs.close(fd);
      try {
        vfs.unlink?.(memPath);
      } catch {
        /* noop */
      }
    }
  }

  // --- フォールバック: Blob ダウンロード ---
  // 全データを一度メモリに展開するため、大容量ファイルは要注意
  const ab = await readMemFile(memPath);
  const blob = new Blob([ab], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (onProgress) onProgress(100);
};
