import * as React from "react";
import type { Edge } from "reactflow";
import * as T from "../domain/type";
import { colHandleIdL, colHandleIdR, sideFromHandle } from "../utils/handleIds";
import { defaultEdgeStyle, buildEdgeStyle } from "../utils/edgeStyle";
import { fkKey, manualEdgeId } from "../utils/fkKey";
import { loadManualFKs, saveManualFKs } from "../state/manualFkStore";

type AddConnArgs = { source: string; sourceHandle: string; target: string; targetHandle: string };

/**
 * useManualEdges
 * =============================================================================
 * ER 図における「手動FK (外部キー) エッジ」の管理を行うカスタムフック。
 *
 * 主な責務:
 * - 手動FKの状態を保持し、永続化 (localStorage) と同期
 * - 手動FKを React Flow の Edge オブジェクトに変換して提供
 * - UI操作（新規接続・自動FKの採用・削除）に応じて状態を更新
 * - エッジスタイルは親コンポーネントで管理する前提とし、ここでは read/write のみ
 */
export function useManualEdges(
  styleMap: T.EdgeStyleMap,
  setStyleMap: React.Dispatch<React.SetStateAction<T.EdgeStyleMap>>
) {
  // ---------------------------------------------------------------------------
  // 1. 状態: 手動FKの配列 + ReactFlow描画用エッジ配列
  //    - 初期化時に localStorage から復元
  // ---------------------------------------------------------------------------
  const [manualFKs, setManualFKs] = React.useState<T.ManualFK[]>(() => loadManualFKs());
  const [edges, setEdges] = React.useState<Edge[]>([]);

  // ---------------------------------------------------------------------------
  // 2. manualFKs または styleMap が変化したら ReactFlow Edge を再構築
  //    - 各FKを Edge オブジェクトに変換
  //    - ハンドルIDを生成し、スタイルを適用
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    const manEdges: Edge[] = manualFKs.map((m) => {
      const srcH = (m.fromSide ?? "R") === "R" ? colHandleIdR(m.fromColumn) : colHandleIdL(m.fromColumn);
      const tgtH = (m.toSide ?? "L") === "L" ? colHandleIdL(m.toColumn) : colHandleIdR(m.toColumn);
      const cfg = styleMap[fkKey(m)] ?? defaultEdgeStyle;
      const built = buildEdgeStyle(cfg);

      return {
        id: manualEdgeId(m),
        source: m.fromTable,
        target: m.toTable,
        sourceHandle: srcH,
        targetHandle: tgtH,
        type: built.type,
        markerStart: built.markerStart,
        markerEnd: built.markerEnd,
        style: built.style,
        selectable: true, // ユーザー選択を許可
      };
    });
    setEdges(manEdges);
  }, [manualFKs, styleMap]);

  // ---------------------------------------------------------------------------
  // 3. Connection (ユーザが描いた線) から手動FKを追加
  //    - 重複チェックを行い、初回なら styleMap にデフォルトスタイルも登録
  // ---------------------------------------------------------------------------
  const addFromConnection = React.useCallback((c: AddConnArgs) => {
    const fromTable = c.source;
    const fromColumn = c.sourceHandle.replace(/^h[LR]-/, "");
    const fromSide = sideFromHandle(c.sourceHandle) as T.HandleSide;
    const toTable = c.target;
    const toColumn = c.targetHandle.replace(/^h[LR]-/, "");
    const toSide = sideFromHandle(c.targetHandle) as T.HandleSide;

    const fk: T.ManualFK = { fromTable, fromColumn, toTable, toColumn, fromSide, toSide };
    const key = manualEdgeId(fk);

    setManualFKs((prev) => {
      if (prev.some((m) => manualEdgeId(m) === key)) return prev; // 既存は無視
      const next = [...prev, fk];
      saveManualFKs(next);

      // 初期スタイルを styleMap に登録
      const styleKey = fkKey(fk);
      setStyleMap((prevMap) => (prevMap[styleKey] ? prevMap : { ...prevMap, [styleKey]: defaultEdgeStyle }));
      return next;
    });
  }, [setStyleMap]);

  // ---------------------------------------------------------------------------
  // 4. 自動推定されたFKを「手動FK」として採用
  //    - 既存キーは無視、新規のみ追加
  //    - 追加分は styleMap にも初期化
  // ---------------------------------------------------------------------------
  const applyAutoAsManual = React.useCallback((autoFks: T.FKTuple[]) => {
    setManualFKs((prev) => {
      const prevSet = new Set(prev.map(fkKey));

      const adds: T.ManualFK[] = autoFks
        .map((k): T.ManualFK => ({
          fromTable: k.fromTable,
          fromColumn: k.fromColumn,
          toTable: k.toTable,
          toColumn: k.toColumn,
          fromSide: "R" as T.HandleSide,
          toSide: "L" as T.HandleSide,
        }))
        .filter((a) => !prevSet.has(fkKey(a)));

      if (!adds.length) return prev;

      const next = [...prev, ...adds];
      saveManualFKs(next);

      setStyleMap((prevMap) => {
        const map = { ...prevMap };
        for (const a of adds) {
          const k = fkKey(a);
          if (!map[k]) map[k] = defaultEdgeStyle;
        }
        return map;
      });

      return next;
    });
  }, [setStyleMap]);

  // ---------------------------------------------------------------------------
  // 5. FKキー (table.col->table.col) を指定して削除
  //    - manualFKs と styleMap の両方から除去
  // ---------------------------------------------------------------------------
  const deleteByKey = React.useCallback((edgeKey: string) => {
    setManualFKs((prev) => {
      const keep = prev.filter((m) => fkKey(m) !== edgeKey);
      saveManualFKs(keep);
      return keep;
    });
    setStyleMap((prev) => {
      const next = { ...prev };
      delete next[edgeKey];
      return next;
    });
  }, [setStyleMap]);

  // ---------------------------------------------------------------------------
  // 6. 公開API: 手動FKのリストと ReactFlowエッジ、操作関数群を返却
  // ---------------------------------------------------------------------------
  return {
    manualFKs,
    edges,
    addFromConnection,
    applyAutoAsManual,
    deleteByKey,
  };
}
