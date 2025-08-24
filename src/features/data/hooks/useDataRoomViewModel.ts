/**
 * useDataRoomViewModel.ts
 * ============================================================================
 * Presentation Layer (React Hook) - DataRoom ViewModel
 *
 * 本フックは DataRoom 画面の「状態管理とユースケース呼び出し」を一元化する。
 * - UI コンポーネントは「このフックから返る状態と操作」を使うだけでよい
 * - SQL 実行やドメインロジックは repo/service に委譲し、ここには置かない
 */

import * as React from "react";
import type { RowObject } from "@/features/data/repositories/sqliteRepo";
import type { TableBasic, ColumnMeta, QualityMetrics, Relation, Page } from "@/features/data/domain/types";
import { listTables, getBasic, getColumns } from "@/features/data/repositories/tableMetaRepo";
import { getQuality } from "@/features/data/services/qualityService";
import { inferRelations } from "@/features/data/services/relationsService";
import { getPreview } from "@/features/data/repositories/previewRepo";
import { getDistinctCount, getSamples } from "@/features/data/repositories/columnStatsRepo";

/**
 * useDataRoomViewModel
 * --------------------------------------------------------------------------
 * DataRoom 画面用のカスタムフック。
 * - テーブル一覧のロード
 * - 選択テーブルのメタ/列/品質/リレーション/プレビュー取得
 * - 再読込, ページング, 列サンプル値の動的ロード
 * を統合的に提供する。
 *
 * 返すもの:
 * - 状態 (tables, selected, basic, columns, quality, relations, preview, loading, err)
 * - 操作関数 (setSelected, setTab, reloadSelected, handleLoadExtras, handlePageChange)
 *
 * 呼び出し側(UI)はこれを利用するだけで、非同期処理や例外処理は隠蔽される。
 */
export function useDataRoomViewModel() {
  /** ---------------- 状態: UI から直接 bind される ---------------- */
  const [tables, setTables] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string | undefined>();
  const [tab, setTab] = React.useState(0);

  const [basic, setBasic] = React.useState<TableBasic | null>(null);
  const [columns, setColumns] = React.useState<ColumnMeta[] | null>(null);
  const [quality, setQuality] = React.useState<QualityMetrics | null>(null);
  const [relations, setRelations] = React.useState<Relation[] | null>(null);
  const [preview, setPreview] = React.useState<Page<RowObject> | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /** ---------------- 初期ロード: テーブル一覧 ---------------- */
  React.useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const t = await listTables();
        setTables(t);
        if (t.length > 0) setSelected((s) => s ?? t[0]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  /** ---------------- 選択テーブルが変わったとき一括ロード ---------------- */
  React.useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 基本情報と列メタを並列で取得
        const [b, cols] = await Promise.all([getBasic(selected), getColumns(selected)]);
        if (cancelled) return;
        setBasic(b);
        setColumns(cols);

        // さらに品質/リレーション/プレビューを並列で取得
        const [q, rels, p] = await Promise.all([
          getQuality(selected, cols),
          inferRelations(selected, cols, tables),
          getPreview(selected, 0, 20),
        ]);
        if (cancelled) return;
        setQuality(q);
        setRelations(rels);
        setPreview(p);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // race condition 対策: 選択切替時に前回呼び出しを無効化
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** ---------------- 再読込 (同じテーブルを再ロード) ---------------- */
  const reloadSelected = React.useCallback(() => {
    if (!selected) return;
    // setSelected に同じ値を入れて強制トリガー
    setSelected(String(selected));
  }, [selected]);

  /** ---------------- 列の distinct/sample 値を動的にロード ---------------- */
  const handleLoadExtras = React.useCallback(async (colName: string) => {
    if (!selected || !columns) return;
    try {
      const [distinctCount, samples] = await Promise.all([
        getDistinctCount(selected, colName),
        getSamples(selected, colName, 5),
      ]);
      setColumns(columns.map((c) =>
        c.name === colName
          ? { ...c, distinctCount: Number(distinctCount ?? 0), sampleValues: samples }
          : c
      ));
    } catch (e) {
      // 本処理は補助的なため、致命的エラーとして扱わずログに留める
      console.error(e);
    }
  }, [columns, selected]);

  /** ---------------- プレビューのページング ---------------- */
  const handlePageChange = React.useCallback(async (page: number, pageSize: number) => {
    if (!selected) return;
    const p = await getPreview(selected, page, pageSize);
    setPreview(p);
  }, [selected]);

  /** ---------------- API (状態 + 操作) を返却 ---------------- */
  return {
    // 状態
    tables, selected, tab, basic, columns, quality, relations, preview, loading, err,
    // 操作
    setSelected, setTab, reloadSelected, handleLoadExtras, handlePageChange,
  };
}
