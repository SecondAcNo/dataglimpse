"use client";

/** クエリ履歴1件分の型 */
export type HistoryItem = { 
  id: string;        // 履歴の一意ID
  sql: string;       // 実行したSQL文字列
  ts: number;        // 実行時刻（UNIXタイムスタンプ）
  favorite: boolean; // お気に入りフラグ
};

/** localStorage に保存するキー */
const HISTORY_KEY = "dg.query.history.v1";

/**
 * 履歴を localStorage から読み込む
 * - JSON.parse に失敗した場合は空配列を返す
 */
export function loadHistory(): HistoryItem[] {
  try { 
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); 
  } catch { 
    return []; 
  }
}

/**
 * 履歴全体を保存（上書き保存）
 */
export function saveHistoryAll(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

/**
 * 履歴に新しいSQLを追加
 * - id は「タイムスタンプ + ランダム文字列」
 * - 最大200件に制限（古いものから削除）
 */
export function pushHistory(sql: string) {
  const now = Date.now();
  const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  saveHistoryAll([
    { id, sql, ts: now, favorite: false }, 
    ...loadHistory()
  ].slice(0, 200));
}

/**
 * 指定した履歴の「お気に入り」をトグル（ON/OFF切り替え）
 */
export function toggleFavorite(id: string) {
  saveHistoryAll(
    loadHistory().map(x => x.id === id ? { ...x, favorite: !x.favorite } : x)
  );
}

/**
 * 指定した履歴を削除
 */
export function removeHistory(id: string) {
  saveHistoryAll(loadHistory().filter(x => x.id !== id));
}

/**
 * 履歴をすべて削除（空配列にリセット）
 */
export function clearHistory() {
  saveHistoryAll([]);
}
