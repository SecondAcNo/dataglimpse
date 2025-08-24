import * as React from "react";
import * as T from "../domain/type";
import { loadEdgeStyleMap, saveEdgeStyleMap } from "../state/edgeStyleStore";
import { defaultEdgeStyle } from "../utils/edgeStyle";

/**
 * useEdgeStyleMap
 * -----------------------------------------------------------------------------
 * カスタムフック: エッジ（線）のスタイル設定を状態管理する。
 * - 状態は React.useState で管理しつつ、外部ストレージ(localStorage 等) にも永続化。
 * - 典型的な「状態 + ストア同期」パターン。
 */
export function useEdgeStyleMap() {
  // ---------------------------------------------------------------------------
  // state: エッジスタイルのマップを保持
  // 初期値は外部ストレージから読み込み（ユーザ設定の復元）
  // ---------------------------------------------------------------------------
  const [styleMap, setStyleMap] = React.useState<T.EdgeStyleMap>(() => loadEdgeStyleMap());

  // ---------------------------------------------------------------------------
  // 永続化: styleMap が変わるたびに外部ストレージへ保存
  // 外部ストアとReact状態の乖離を防ぐ
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    saveEdgeStyleMap(styleMap);
  }, [styleMap]);

  // ---------------------------------------------------------------------------
  // styleForKey:
  // 特定のエッジIDに対応するスタイル設定を返す。
  // 存在しない場合はデフォルトスタイルを返す（null safety）
  // ---------------------------------------------------------------------------
  const styleForKey = React.useCallback(
    (key: string): T.EdgeStyleConfig => styleMap[key] ?? defaultEdgeStyle,
    [styleMap]
  );

  // ---------------------------------------------------------------------------
  // ensureDefault:
  // 指定したキーにスタイルが存在しない場合のみ、defaultEdgeStyle をセットする。
  // 主に「新規エッジ追加時」に利用する。
  // ---------------------------------------------------------------------------
  const ensureDefault = React.useCallback((key: string) => {
    setStyleMap(prev => (prev[key] ? prev : { ...prev, [key]: defaultEdgeStyle }));
  }, []);

  // ---------------------------------------------------------------------------
  // deleteKey:
  // 指定したキーを styleMap から削除。
  // 削除対象が存在しなければ no-op。
  // ---------------------------------------------------------------------------
  const deleteKey = React.useCallback((key: string) => {
    setStyleMap(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // 公開API: コンポーネント側で利用するエントリポイント群
  // ---------------------------------------------------------------------------
  return { styleMap, setStyleMap, styleForKey, ensureDefault, deleteKey };
}
