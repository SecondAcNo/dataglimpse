"use client";

import * as React from "react";
import {
  type Node, type Edge, type EdgeChange, type Connection, type DefaultEdgeOptions, ConnectionMode,
} from "reactflow";
import * as T from "../domain/type";
import { defaultEdgeStyle, buildEdgeStyle } from "../utils/edgeStyle";
import { fkKey } from "../utils/fkKey";
import { resetLayout } from "../services/layoutStore";
import { loadOverrides, saveOverrides, setColumnOverrideLocal, clearTableOverridesLocal } from "../state/overridesStore";
import { useNodeGraph } from "./useNodeGraph";
import { useManualEdges } from "./useManualEdges";
import { useEdgeStyleMap } from "./useEdgeStyleMap";
import { useMetaLoader } from "./useMetaLoader";

/**
 * ERViewModel
 * -----------------------------------------------------------------------------
 * ERページの「状態とイベントハンドラ」を View に提供するための型。
 * 
 * - React Flow に描画するための nodes/edges 情報
 * - ページ全体の状態 (loading/error/empty)
 * - 各種ユーザーアクションハンドラ (ノードクリック, エッジ接続, 編集など)
 * - 列のオーバーライド情報やエッジスタイルの編集状態
 * 
 * View 側はこのインターフェースを props として受け取るだけでよく、
 * データ取得や永続化、内部的な状態管理はすべてこの ViewModel 内に隠蔽される。
 */
export type ERViewModel = {
  // ---- ページ全体状態 ----
  loading: boolean;
  error: string | null;
  empty: boolean;
  nodes: Node<T.TableNodeData>[];
  edges: Edge[];
  connectionMode: ConnectionMode;
  defaultEdgeOptions: DefaultEdgeOptions;

  // ---- React Flow ハンドラ ----
  onNodesChange: ReturnType<typeof useNodeGraph>["onNodesChange"];
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  onEdgeClick: (e: React.MouseEvent, edge: Edge) => void;
  onNodeClick: (e: React.MouseEvent, node: Node<T.TableNodeData>) => void;

  // ---- 操作用 API ----
  onReload: () => Promise<void> | void;
  onResetLayout: () => void;
  onApplyAuto: () => void;
  pendingAdds: number;

  // ---- テーブル編集関連 ----
  editTable: T.TableMetaView | null;
  onCloseEditTable: () => void;
  overrides: T.Overrides;
  setColumnOverride: (table: string, col: string, patch: T.ColumnOverridePatch) => void;
  clearTableOverrides: (table: string) => void;
  defaultBadgeCols: Set<string>;

  // ---- エッジ編集関連 ----
  editingEdgeKey: string | null;
  editingStyle: T.EdgeStyleConfig;
  setEditingStyle: (v: T.EdgeStyleConfig) => void;
  resetEditingStyleToDefault: () => void;
  deleteEditingEdge: () => void;
  closeEditingEdge: () => void;
};

/**
 * useERPageViewModel
 * -----------------------------------------------------------------------------
 * ER 図ページ用の「ViewModel」を構築するカスタムフック。
 * 
 * 責務:
 * - DB メタデータの取得 (useMetaLoader)
 * - ノードとレイアウト計算 (useNodeGraph)
 * - 手動エッジ管理と自動FKの適用 (useManualEdges)
 * - エッジスタイルの保持/編集 (useEdgeStyleMap)
 * - 列オーバーライド情報の保存・永続化 (overridesStore)
 * - ユーザー操作イベント (ノードクリック, エッジクリック, 接続など)
 * 
 * 設計方針:
 * - UI はこの Hook の返却値だけを利用する「薄い層」
 * - 状態管理や副作用 (localStorage 保存など) はここに閉じ込める
 * - ページの唯一の「状態ソース」として機能し、テスト容易性も確保
 */
export function useERPageViewModel(): ERViewModel {
  // ---------------------------------------------------------------------------
  // 1. メタ情報 + 自動推論されたFK (専用フックに委譲)
  // ---------------------------------------------------------------------------
  const { tablesMeta, autoFks, loading, error, empty, reload } = useMetaLoader();

  // ---------------------------------------------------------------------------
  // 2. 列オーバーライド設定 (永続化付き)
  //    - 初期ロード時に localStorage から復元
  //    - 変更時には saveOverrides に保存
  // ---------------------------------------------------------------------------
  const [overrides, setOverrides] = React.useState<T.Overrides>(() => loadOverrides());
  React.useEffect(() => { saveOverrides(overrides); }, [overrides]);

  // ---------------------------------------------------------------------------
  // 3. エッジスタイル設定 (線種・色など) を管理
  // ---------------------------------------------------------------------------
  const { styleMap, setStyleMap, styleForKey, deleteKey: deleteStyleKey } = useEdgeStyleMap();

  // ---------------------------------------------------------------------------
  // 4. ノード生成 (テーブルメタ情報 + オーバーライド + レイアウト適用)
  // ---------------------------------------------------------------------------
  const { nodes, onNodesChange, nameBasedBadgeByTable } = useNodeGraph(tablesMeta, overrides);

  // ---------------------------------------------------------------------------
  // 5. 手動エッジ管理
  //    - React Flow の接続操作から追加
  //    - 自動FKを「手動として採用」できる
  //    - 削除も可能
  // ---------------------------------------------------------------------------
  const { manualFKs, edges, addFromConnection, applyAutoAsManual, deleteByKey } =
    useManualEdges(styleMap, setStyleMap);

  // ---------------------------------------------------------------------------
  // 6. 編集対象状態
  //    - 選択中のテーブル情報
  //    - 編集対象のエッジキー
  // ---------------------------------------------------------------------------
  const [editTable, setEditTable] = React.useState<T.TableMeta | null>(null);
  const [editingEdgeKey, setEditingEdgeKey] = React.useState<string | null>(null);

  // ノードクリック時に編集対象テーブルをセット
  const onNodeClick = React.useCallback((_e: React.MouseEvent, node: Node<T.TableNodeData>) => {
    setEditTable({ name: node.data.name, columns: node.data.columns.map((c) => ({ ...c, uniqueNoNull: false, isPk: false })) });
  }, []);

  // EdgeChange は現状 UI イベント用に空実装
  const onEdgesChange = React.useCallback(() => {}, []);

  // 新規接続操作 → 手動エッジを追加
  const onConnect = React.useCallback((c: Connection) => {
    if (!c.source || !c.sourceHandle || !c.target || !c.targetHandle) return;
    addFromConnection({
      source: String(c.source),
      sourceHandle: String(c.sourceHandle),
      target: String(c.target),
      targetHandle: String(c.targetHandle),
    });
  }, [addFromConnection]);

  // エッジクリック時 → 編集対象エッジをセット
  const onEdgeClick = React.useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (!edge.id.startsWith("mfk-")) return; // 手動FKのみ対象
    setEditingEdgeKey(edge.id.replace(/^mfk-/, ""));
  }, []);

  // 自動FKを手動エッジとして採用
  const onApplyAuto = React.useCallback(() => {
    applyAutoAsManual(autoFks);
  }, [applyAutoAsManual, autoFks]);

  // 未反映の自動FK数を計算
  const pendingAdds = React.useMemo(() => {
    const manualSet = new Set(manualFKs.map(fkKey));
    let add = 0;
    for (const k of autoFks) if (!manualSet.has(fkKey(k))) add++;
    return add;
  }, [autoFks, manualFKs]);

  // ---------------------------------------------------------------------------
  // 7. エッジスタイル編集
  //    - 現在編集中のエッジスタイルを取得/更新/リセット/削除
  // ---------------------------------------------------------------------------
  const editingStyle: T.EdgeStyleConfig = editingEdgeKey ? styleForKey(editingEdgeKey) : defaultEdgeStyle;
  const setEditingStyle = (v: T.EdgeStyleConfig) => {
    if (!editingEdgeKey) return;
    setStyleMap((prev) => ({ ...prev, [editingEdgeKey]: v }));
  };
  const resetEditingStyleToDefault = () => {
    if (!editingEdgeKey) return;
    setStyleMap((prev) => ({ ...prev, [editingEdgeKey]: defaultEdgeStyle }));
  };
  const deleteEditingEdge = () => {
    if (!editingEdgeKey) return;
    deleteByKey(editingEdgeKey);
    deleteStyleKey(editingEdgeKey);
    setEditingEdgeKey(null);
  };

  // ---------------------------------------------------------------------------
  // 8. View 向けデータ変換
  //    - 編集ダイアログ用に必要最低限のフィールドだけ抽出
  //    - デフォルトバッジ列 (主にユニーク性など)
  // ---------------------------------------------------------------------------
  const editTableForView: T.TableMetaView | null = React.useMemo(() => {
    if (!editTable) return null;
    return {
      name: editTable.name,
      columns: editTable.columns.map(({ name, dataType }) => ({ name, dataType })),
    };
  }, [editTable]);

  const defaultBadgeCols = React.useMemo(() => {
    if (!editTable) return new Set<string>();
    const set = nameBasedBadgeByTable.get(editTable.name);
    return set ? new Set<string>(set) : new Set<string>();
  }, [editTable, nameBasedBadgeByTable]);

  // ---------------------------------------------------------------------------
  // 9. 列オーバーライド操作API
  //    - 特定の列にメタ情報上書きを適用/解除
  // ---------------------------------------------------------------------------
  const setColumnOverride = (table: string, col: string, patch: T.ColumnOverridePatch) =>
    setOverrides((ov) => setColumnOverrideLocal(ov, table, col, patch));
  const clearTableOverrides = (table: string) =>
    setOverrides((ov) => clearTableOverridesLocal(ov, table));

  // ---------------------------------------------------------------------------
  // 10. ViewModel として返却
  // ---------------------------------------------------------------------------
  return {
    // 状態
    loading,
    error,
    empty,
    nodes,
    edges,
    connectionMode: ConnectionMode.Loose,
    defaultEdgeOptions: buildEdgeStyle(defaultEdgeStyle),

    // Flow handlers
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeClick,
    onNodeClick,

    // 操作
    onReload: reload,
    onResetLayout: () => { resetLayout(); void reload(); },
    onApplyAuto,
    pendingAdds,

    // 列編集
    editTable: editTableForView,
    onCloseEditTable: () => setEditTable(null),
    overrides,
    setColumnOverride,
    clearTableOverrides,
    defaultBadgeCols,

    // 線スタイル編集
    editingEdgeKey,
    editingStyle,
    setEditingStyle,
    resetEditingStyleToDefault,
    deleteEditingEdge,
    closeEditingEdge: () => setEditingEdgeKey(null),
  };
}
