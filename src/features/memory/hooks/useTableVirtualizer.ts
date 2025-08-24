"use client";

import { useRef } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

/**
 * テーブル用の仮想スクロール設定をカプセル化したフック
 * @param count レンダリング対象行数
 * @param options.rowHeight 行の推定高さ（px）デフォルト 36
 * @param options.overscan 先読み行数（上下）デフォルト 6
 */
export default function useTableVirtualizer(
  count: number,
  options?: { rowHeight?: number; overscan?: number }
) {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => options?.rowHeight ?? 36,
    overscan: options?.overscan ?? 6,
  });

  return {
    tableContainerRef,
    virtualItems: virtualizer.getVirtualItems() as VirtualItem[],
    totalSize: virtualizer.getTotalSize(),
  };
}
