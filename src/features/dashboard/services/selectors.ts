"use client";

/**
 * selectors.ts
 * -----------------------------------------------------------------------------
 * 役割:
 *  - ダッシュボードの「派生データ」を計算する React フック群（純粋セレクタ）。
 *  - 生の統計（行数・列数・NULL率など）や FK 推定結果を、可視化/カード表示に
 *    そのまま渡せる形へ整形する。
 *
 * 設計メモ:
 *  - すべての関数は副作用を持たない「メモ化セレクタ」。`useMemo` により
 *    依存配列の同値性が保たれる限り、再計算を避ける。
 *  - 入力に新しい配列インスタンスを毎回渡すと `useMemo` が破棄されるため、
 *    呼び出し元は可能なら同一参照（または安定化したストア）を渡すこと。
 */

import * as React from "react";
import {
  TOP_ROWS_N,
  SIZE_TOP_N,
  COMPLETENESS_WORST_N,
  BLUE_SCALE,
} from "@/features/dashboard/constants/chart";

/* =============================================================================
 * Types
 * ========================================================================== */

/**
 * テーブル単位の基本統計。
 * - `avgNullRate` は 0..1 の割合（例: 0.25 = 25%）
 * - `sizeScore` は 行×列 の簡易重み（視覚化の相対尺度）
 */
export type Stat = {
  name: string;
  rows: number;
  cols: number;
  sizeScore: number;
  avgNullRate: number; // 0..1
};

/**
 * FK 推定の最小要素。
 * - 本ファイルでは「子テーブル側の件数集計（外向き FK 本数）」にしか使わないため
 *   source のみ定義。必要に応じて col/target 等は呼び出し元の型を利用。
 */
export type FKEdge = { source: string };

/* =============================================================================
 * Selectors
 * ========================================================================== */

/**
 * 行数上位 N 件を返す。
 *
 * @param stats  テーブル統計配列
 * @param n      返す件数（既定: TOP_ROWS_N）
 * @returns      [{ name, rows }] の配列（降順）
 *
 * 計算量: O(M log M) （M = stats.length、ソート支配）
 * 備考:
 *  - ソートは安定実装だが、同値のときの順序は依存しない前提でOK。
 */
export function useTopRows(stats: Stat[], n = TOP_ROWS_N) {
  return React.useMemo(
    () =>
      [...stats]
        .sort((a, b) => b.rows - a.rows)
        .slice(0, n)
        .map((s) => ({ name: s.name, rows: s.rows })),
    [stats, n],
  );
}

/**
 * サイズ感（行×列）上位 N 件を返す。
 * Recharts の RadialBar などにそのまま渡せる形（fill を付与）。
 *
 * @param stats    テーブル統計配列
 * @param n        返す件数（既定: SIZE_TOP_N）
 * @param palette  面色パレット（既定: BLUE_SCALE）。不足時はループ（mod）。
 * @returns        [{ name, rows, cols, score, fill }]
 *
 * 計算量: O(M log M)
 * 注意:
 *  - `palette.length < n` の場合でも `i % palette.length` で循環する。
 */
export function useSizeTop(
  stats: Stat[],
  n = SIZE_TOP_N,
  palette: string[] = BLUE_SCALE,
) {
  return React.useMemo(
    () =>
      [...stats]
        .sort((a, b) => b.sizeScore - a.sizeScore)
        .slice(0, n)
        .map((s, i) => ({
          name: s.name,
          rows: s.rows,
          cols: s.cols,
          score: s.sizeScore,
          fill: palette[i % palette.length],
        })),
    [stats, n, palette],
  );
}

/**
 * データ完全性（100 - 平均NULL率%）が低い順（= ワースト）に N 件返す。
 *
 * @param stats  テーブル統計配列
 * @param n      返す件数（既定: COMPLETENESS_WORST_N）
 * @returns      [{ name, completeness, nullRate }]（completeness/nullRate は %）
 *
 * 計算量: O(M log M)
 * 表記:
 *  - `avgNullRate` は 0..1 なので、% へ変換して小数 2 桁で丸める。
 */
export function useCompletenessWorst(stats: Stat[], n = COMPLETENESS_WORST_N) {
  return React.useMemo(
    () =>
      [...stats]
        .map((s) => ({
          name: s.name,
          completeness: +(100 - s.avgNullRate * 100).toFixed(2),
          nullRate: +(s.avgNullRate * 100).toFixed(2),
        }))
        .sort((a, b) => a.completeness - b.completeness)
        .slice(0, n),
    [stats, n],
  );
}

/**
 * 子テーブルの FK 列数 TOP（外部キー候補列の本数を子テーブル単位で集計）。
 * 例: orders が user_id, product_id を持てば orders の count=2。
 *
 * @param fkEdges FK 推定結果（少なくとも source を含む）
 * @param n       返す件数（既定: TOP_ROWS_N）
 * @returns       [{ name, count }]（降順）
 *
 * 計算量: O(E) + O(T log T)
 *  - E: fkEdges.length（集計）
 *  - T: 集計後のテーブル数（ソート）
 */
export function useOutboundTop(fkEdges: FKEdge[], n = TOP_ROWS_N) {
  return React.useMemo(() => {
    const m = new Map<string, number>(); // name -> count
    for (const e of fkEdges) m.set(e.source, (m.get(e.source) ?? 0) + 1);

    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }, [fkEdges, n]);
}
