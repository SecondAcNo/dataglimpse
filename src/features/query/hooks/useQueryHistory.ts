"use client";

import * as React from "react";
import {
  type HistoryItem,
  loadHistory,
  pushHistory,
  toggleFavorite as svcToggleFavorite,
  removeHistory as svcRemoveHistory,
  clearHistory as svcClearHistory,
} from "@/features/query/services/history";

/**
 * useQueryHistory
 * -----------------------------------------------------------------------------
 * クエリ履歴の状態管理と操作をまとめたカスタムフック。
 * - 状態: 履歴一覧 / ダイアログ開閉状態
 * - 操作: 履歴追加・削除・お気に入り切替・全削除
 * - データの保存/読み込みは services/history に委譲
 */
export function useQueryHistory() {
  /** 履歴ダイアログの開閉状態 */
  const [historyOpen, setHistoryOpen] = React.useState(false);

  /** 履歴一覧（localStorage ベース） */
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  /** 初期ロード（マウント時に履歴をロード） */
  React.useEffect(() => {
    setHistory(loadHistory());
  }, []);

  /** ダイアログを開く */
  const openHistory = React.useCallback(() => setHistoryOpen(true), []);

  /** ダイアログを閉じる */
  const closeHistory = React.useCallback(() => setHistoryOpen(false), []);

  /** 履歴を追加（SQLを保存→再ロード） */
  const addHistory = React.useCallback((sql: string) => {
    pushHistory(sql);
    setHistory(loadHistory());
  }, []);

  /** 履歴のお気に入り状態を切り替え */
  const toggleFavorite = React.useCallback((id: string) => {
    svcToggleFavorite(id);
    setHistory(loadHistory());
  }, []);

  /** 特定の履歴を削除 */
  const removeHistory = React.useCallback((id: string) => {
    svcRemoveHistory(id);
    setHistory(loadHistory());
  }, []);

  /** 履歴をすべて削除 */
  const clearHistory = React.useCallback(() => {
    svcClearHistory();
    setHistory(loadHistory());
  }, []);

  /** View / Container 側に返すAPI */
  return {
    historyOpen,     // ダイアログ開閉状態
    history,         // 履歴一覧
    openHistory,     // 開く
    closeHistory,    // 閉じる
    addHistory,      // 追加
    toggleFavorite,  // お気に入り切替
    removeHistory,   // 削除
    clearHistory,    // 全削除
  };
}
