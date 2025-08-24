"use client";

/**
 * useDashboardData
 * -----------------------------------------------------------------------------
 * ダッシュボードで必要な集計データを取得し、描画しやすい形に派生加工して返すフック。
 * - 初回マウント時に自動ロード
 * - load() を公開（手動再読込用）
 */

import * as React from "react";
import {  getTableStats, inferFkEdges, buildTypeDistribution, buildUniqueRatioTop,
  buildPareto, buildCorrelationTop, edgesToCoverageBars,
} from "@/features/dashboard/services/analytics";
import type { TableStat, FkEdge, TypeDistRow, UniqueRatioRow, ParetoPoint,
  CorrBar, FkCoverageBar,
} from "@/features/dashboard/services/analytics";

/**
 * useDashboardData
 * -----------------------------------------------------------------------------
 * ダッシュボードで必要な集計データを取得し、描画しやすい形に派生加工して返すフック。
 * - 初回マウント時に自動ロード
 * - load() を公開（手動再読込用）
 *
 * 返却する主な値:
 * - data: tables, stats, loading, fkEdges, typeDist, uniqueTop, pareto, corrTop, fkCoverageBars
 * - derived: relationMatrix(旧API互換), corrDomain, formatRelationTooltip
 * - actions: load
 */
export function useDashboardData() {
  const [tables, setTables] = React.useState<string[]>([]);
  const [stats, setStats] = React.useState<TableStat[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fkEdges, setFkEdges] = React.useState<FkEdge[]>([]);
  const [typeDist, setTypeDist] = React.useState<TypeDistRow[]>([]);
  const [uniqueTop, setUniqueTop] = React.useState<UniqueRatioRow[]>([]);
  const [pareto, setPareto] = React.useState<{ data: ParetoPoint[]; meta?: { table: string; column: string } }>({ data: [] });
  const [corrTop, setCorrTop] = React.useState<CorrBar[]>([]);

  /**
   * データ一括ロード
   * 1) テーブル統計（名前リスト含む）
   * 2) 名前リストを使って各種集計を並列取得
   */
  const load = React.useCallback(async () => {
    setLoading(true);

    // 1) 基本統計（名前や行/列数など）
    const s = await getTableStats();
    const names = s.map(v => v.name);
    setTables(names);
    setStats(s);

    // 2) 名前リストを基に重めの集計を並列実行
    const [edges, td, ur, pr, ct] = await Promise.all([
      inferFkEdges(names),          // FK候補（子→親）の推定
      buildTypeDistribution(names), // 列型の内訳（テーブル別）
      buildUniqueRatioTop(names),   // 列ユニーク比TOP
      buildPareto(names),           // カテゴリ分布の上位/累積
      buildCorrelationTop(names),   // 数値列相関TOP（|r|%）
    ]);

    // 取得した結果をまとめて反映
    setFkEdges(edges);
    setTypeDist(td);
    setUniqueTop(ur);
    setPareto(pr);
    setCorrTop(ct);

    setLoading(false);
  }, []);

  // 初回マウント時に自動ロード
  React.useEffect(() => { void load(); }, [load]);

  // === Derived（描画都合の派生計算）===
  /**
   * 相関チャートのY軸上限（0〜upper）
   * - 最大値に25% or 最低5の余白を足し、5刻みへ切り上げ
   * - 上限は最大100%まで
   */
  const corrMax = React.useMemo(
    () => (corrTop.length ? Math.max(...corrTop.map(d => d.corrAbs)) : 0),
    [corrTop]
  );
  const corrDomain = React.useMemo<[number, number]>(() => {
    const pad = Math.max(5, corrMax * 0.25);
    const upper = Math.min(100, Math.max(10, Math.ceil((corrMax + pad) / 5) * 5));
    return [0, upper];
  }, [corrMax]);

  /**
   * FKカバレッジ棒グラフ用データ（上位関係を抽出/整形）
   */
  const fkCoverageBars: FkCoverageBar[] = React.useMemo(
    () => edgesToCoverageBars(fkEdges),
    [fkEdges]
  );

  return {
    // 生データ
    tables, stats, loading,
    fkEdges, typeDist, uniqueTop, pareto, corrTop, fkCoverageBars,

    // 派生（互換APIを含む）
    corrDomain,

    // アクション
    load,
  };
}
