import * as React from "react";
import { type Node, type NodeChange, applyNodeChanges } from "reactflow";
import * as T from "../domain/type";
import { loadLayout, saveLayout } from "../services/layoutStore";
import { buildNameBasedBadgeByTable } from "../services/badgeHeuristics";

const isBool = (v: unknown): v is boolean => typeof v === "boolean";

/**
 * useNodeGraph
 * =============================================================================
 * ER 図の「ノード集合（テーブル群）」を構築・管理するカスタムフック。
 *
 * 主な責務:
 * - tablesMeta（DBスキーマ情報）と overrides（ユーザ編集の上書き設定）から ReactFlow ノードを生成
 * - 列ごとの属性 (PK / UNIQUE / FK候補バッジ) を算出
 * - レイアウト情報をロード・適用し、ノード位置の変更を保存
 * - 名前ベースのバッジ推定 (例: `*_id` → FK候補) をサービス層に委譲
 */
export function useNodeGraph(
  tablesMeta: T.TableMeta[] | null,   // DBから取得したテーブル・カラム情報
  overrides: T.Overrides              // ユーザによる列属性の上書き指定
): {
  nodes: Node<T.TableNodeData>[];     // ReactFlow ノードリスト
  onNodesChange: (changes: NodeChange[]) => void; // ノード座標更新ハンドラ
  nameBasedBadgeByTable: Map<string, Set<string>>; // 列名から推定したバッジ情報
} {
  // ReactFlow が描画するノード群
  const [nodes, setNodes] = React.useState<Node<T.TableNodeData>[]>([]);
  // テーブルごとに、列名からヒューリスティックで推定されたバッジ集合
  const [nameBasedBadgeByTable, setBadgeMap] = React.useState<Map<string, Set<string>>>(new Map());

  // ----------------------------------------------------------------------------
  // 1. tablesMeta または overrides が更新されたらノードを再構築
  // ----------------------------------------------------------------------------
  React.useEffect(() => {
    if (!tablesMeta) return;

    // 列名ヒューリスティックから「バッジ候補列」を推定
    const badgeMap = buildNameBasedBadgeByTable(tablesMeta);
    setBadgeMap(badgeMap);

    // 各テーブルを ReactFlow Node に変換
    const nodesBuilt: Node<T.TableNodeData>[] = tablesMeta.map((t, i) => {
      const tOv = overrides[t.name] ?? {};        // 当該テーブルの上書き設定
      const effPk = new Set<string>();            // 有効なPK列
      const effUnique = new Set<string>();        // 有効なUNIQUE列
      const effFkBadge = new Set<string>();       // 有効なFK候補バッジ列
      const badgeDefaults = badgeMap.get(t.name) ?? new Set<string>();

      // 列ごとに「デフォルト値 or 上書き指定」で最終的な属性を決定
      for (const col of t.columns) {
        const o = tOv[col.name] ?? {};
        const pkDefault = col.name.toLowerCase() === "id"; // デフォルト: "id" 列はPK
        const uqDefault = false;                           // UNIQUEのデフォルトは false
        const badgeDefault = badgeDefaults.has(col.name);  // 名前ベースでの候補

        if (isBool(o.isPk) ? o.isPk : pkDefault) effPk.add(col.name);
        if (isBool(o.isUnique) ? o.isUnique : uqDefault) effUnique.add(col.name);
        if (isBool(o.fkBadge) ? o.fkBadge : badgeDefault) effFkBadge.add(col.name);
      }

      return {
        id: t.name,
        position: { 
          x: 40 + (i % 3) * 420, 
          y: 40 + Math.floor(i / 3) * 260 
        },
        data: {
          name: t.name,
          columns: t.columns.map(({ name, dataType }) => ({ name, dataType })),
          effPk,
          effUnique,
          effFkBadge,
        },
        type: "tableNode",
      };
    });

    // 保存済みレイアウトがあれば上書き適用
    const saved = loadLayout();
    const resolved = saved
      ? nodesBuilt.map((n) => (saved[n.id] ? { ...n, position: saved[n.id] } : n))
      : nodesBuilt;

    setNodes(resolved);
  }, [tablesMeta, overrides]);

  // ----------------------------------------------------------------------------
  // 2. ノード変更イベント
  //    - ReactFlow のノード座標変更を反映
  //    - 変更後レイアウトを永続化
  // ----------------------------------------------------------------------------
  const onNodesChange = React.useCallback((changes: NodeChange[]) => {
    setNodes((prev) => {
      const next = applyNodeChanges(changes, prev);
      saveLayout(next.map((n) => ({ id: n.id, position: n.position })));
      return next;
    });
  }, []);

  // ----------------------------------------------------------------------------
  // 3. 公開API
  // ----------------------------------------------------------------------------
  return { nodes, onNodesChange, nameBasedBadgeByTable };
}
