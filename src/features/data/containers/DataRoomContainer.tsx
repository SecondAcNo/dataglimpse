"use client";

import * as React from "react";
import { DataRoomView } from "@/features/data/views/DataRoomView";
import { useDataRoomViewModel } from "@/features/data/hooks/useDataRoomViewModel";

/**
 * DataRoomContainer
 * -----------------------------------------------------------------------------
 * 役割:
 * - ViewModel（サーバ/DBアクセスや副作用のオーケストレーション）を呼び出し、
 *   画面に必要な状態とハンドラを View に受け渡す「接着層」。
 * - UI レイアウトや見た目の責務は一切持たず、描画は View に委譲する。
 */
export function DataRoomContainer() {
  const vm = useDataRoomViewModel();

  /**
   * CSV ダウンロード（プレビュー範囲）
   * -----------------------------------------------------------------------------
   * - View はこのトリガのみ呼び出す。実処理は Container 側で実行。
   * - 安全対策:
   *   - ファイル名のサニタイズ（OS/ブラウザ依存の禁止文字を除去）
   *   - 値は常に CSV エスケープ（ダブルクオートで囲み、内部の"は二重化）
   *   - Excel での文字化け回避のため UTF-8 BOM 付与
   *   - ObjectURL の確実な revoke（setTimeout で非同期解放）
   */
  const onDownloadCsv = React.useCallback(() => {
    const preview = vm.preview;
    if (!preview || preview.rows.length === 0) return;

    // --- ファイル名をサニタイズ（制御文字や記号を許容しない） ---
    const rawBase = vm.selected ?? "preview";
    const safeBase = rawBase.replace(/[^a-zA-Z0-9._-]/g, "_"); // 余分な文字をアンダースコアへ
    const fileName = `${safeBase}.page${(preview.page ?? 0) + 1}.csv`;

    // --- 列抽出（先頭行からキー） ---
    const first = preview.rows[0] as Record<string, unknown>;
    const cols = Object.keys(first);

    // --- 値の安全な文字列化 ---
    const toCellString = (v: unknown): string => {
      if (v == null) return "";
      const t = typeof v;
      if (t === "string" || t === "number" || t === "boolean" || t === "bigint") return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };

    // --- CSV エスケープ（ダブルクオート囲み & 内部の " を "" に） ---
    const escapeCsv = (s: string): string => `"${s.replaceAll('"', '""')}"`;

    // --- CSV 本体生成（BOM 付） ---
    const header = cols.map(escapeCsv).join(",");
    const body = preview.rows
      .map((r) => cols.map((c) => escapeCsv(toCellString((r as Record<string, unknown>)[c]))).join(","))
      .join("\n");

    // UTF-8 BOM を先頭に付与（Excel 対応）
    const BOM = "\uFEFF";
    const csv = `${BOM}${header}\n${body}`;

    // --- ダウンロード実行（ObjectURL は後始末） ---
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;

    // 一時的に DOM に追加（Firefox 対策）
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // すぐ revoke すると稀にダウンロードが失敗するブラウザがあるため遅延
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [vm.preview, vm.selected]);

  return (
    <DataRoomView
      tables={vm.tables}
      selected={vm.selected}
      tab={vm.tab}
      basic={vm.basic}
      columns={vm.columns}
      quality={vm.quality}
      relations={vm.relations}
      preview={vm.preview}
      loading={vm.loading}
      err={vm.err}
      setSelected={vm.setSelected}
      setTab={vm.setTab}
      reloadSelected={vm.reloadSelected}
      handleLoadExtras={vm.handleLoadExtras}
      handlePageChange={vm.handlePageChange}
      onDownloadCsv={onDownloadCsv}
    />
  );
}
