"use client";

/**
 * DashboardContainer
 * -----------------------------------------------------------------------------
 * 役割:
 *  - 集計フックからデータを取得
 *  - 一覧状態（検索/ページング/選択）を保持
 *  - 派生計算（TopN 等）をセレクタでメモ化
 *  - 破壊操作（DROP/RENAME）を実行
 *  - 描画は View に全委譲
 */

import * as React from "react";
import { exec } from "@/lib/sqlite";
import { safeIdent } from "@/features/dashboard/lib/schema";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import useTableSelection from "@/features/dashboard/hooks/useTableSelection";
import { DashboardView } from "@/features/dashboard/views/DashboardView";
import { useTopRows, useSizeTop, useCompletenessWorst, useOutboundTop,
  type Stat, type FKEdge, } from "@/features/dashboard/services/selectors";
import { PAGE_SIZE_DEFAULT } from "@/features/dashboard/constants/table";

export function DashboardContainer() {
  // 集計済みデータ一式
  const data = useDashboardData();

  // 一覧の状態（検索・ページング・選択）
  const selection = useTableSelection(data.tables, data.stats, PAGE_SIZE_DEFAULT);

  // KPI（軽量計算）
  const totalRows = data.stats.reduce((a, b) => a + b.rows, 0);
  const totalCols = data.stats.reduce((a, b) => a + b.cols, 0);
  const avgCols = data.stats.length ? Math.round(totalCols / data.stats.length) : 0;

  // カード用派生（重めはメモ化）
  const topRows = useTopRows(data.stats as Stat[]);
  const sizeTop = useSizeTop(data.stats as Stat[]);
  const completenessWorst = useCompletenessWorst(data.stats as Stat[]);
  const outboundTop = useOutboundTop(data.fkEdges as FKEdge[]);

  // 破壊操作（安全化 → 実行 → 再読込）
  const dropOne = async (name: string) => {
    await exec(`DROP TABLE ${safeIdent(name)}`);
    selection.clearSelection();
    await data.load();
  };

  // 読み込みテーブル名リネーム
  const rename = async (from: string, to: string) => {
    await exec(`ALTER TABLE ${safeIdent(from)} RENAME TO ${safeIdent(to)}`);
    selection.clearSelection();
    await data.load();
  };

  // 全削除
  const dropMany = async (names: string[]) => {
    if (!names.length) return;
    const sql = `BEGIN; ${names.map(n => `DROP TABLE ${safeIdent(n)};`).join(" ")} COMMIT;`;
    await exec(sql);
    selection.clearSelection();
    await data.load();
  };

  return (
    <DashboardView
      // 生データ（View が使う分のみ）
      tables={data.tables}
      loading={data.loading}
      typeDist={data.typeDist}
      uniqueTop={data.uniqueTop}
      pareto={data.pareto}
      corrTop={data.corrTop}
      fkCoverageBars={data.fkCoverageBars}
      corrDomain={data.corrDomain}
      reload={data.load}
      // KPI
      kpis={{ totalRows, totalCols, avgCols, fkCount: data.fkEdges.length }}
      // 派生済み
      derived={{ topRows, sizeTop, completenessWorst, outboundTop }}
      // 一覧状態
      selection={selection}
      // アクション
      actions={{ dropOne, dropMany, rename }}
    />
  );
}

export default DashboardContainer;
