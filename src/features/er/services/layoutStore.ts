/**
 * LayoutStore
 * =============================================================================
 * ReactFlow ノードのレイアウト（座標情報）をブラウザ localStorage に永続化するユーティリティ。
 *
 * 制約:
 * - ブラウザごとに保存（ユーザ間共有はされない）
 * - JSON文字列化するため循環構造は不可
 * - localStorage 容量上限に依存（通常は問題なし）
 */

export type LayoutMap = Record<string, { x: number; y: number }>;

// -----------------------------------------------------------------------------
// ストレージキー: バージョン番号を付与して将来の非互換変更に対応可能にする。
// v1 → 今後スキーマ変更時には v2 などを新設する。
// -----------------------------------------------------------------------------
const KEY = "dg-er-layout-v1";

/**
 * saveLayout
 * -----------------------------------------------------------------------------
 * 現在のノード配列から {id, position} を抽出し、localStorage に保存。
 *
 * - Object.fromEntries を用いて ID → 座標 の辞書に変換
 * - 保存失敗時（ストレージフル・Safari プライベートモードなど）は黙殺
 */
export function saveLayout(
  nodes: Array<{ id: string; position: { x: number; y: number } }>
): void {
  const map = Object.fromEntries(nodes.map((n) => [n.id, n.position] as const));
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore (storage quota exceeded, unavailable, etc.) */
  }
}

/**
 * loadLayout
 * -----------------------------------------------------------------------------
 * localStorage からレイアウトを復元。
 *
 * - JSON.parse に失敗した場合は null を返す
 * - データ不整合時にも安全に fallback
 * - 呼び出し側は null チェックで「保存レイアウトなし」ケースを処理する想定
 */
export function loadLayout(): LayoutMap | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LayoutMap) : null;
  } catch {
    return null;
  }
}

/**
 * resetLayout
 * -----------------------------------------------------------------------------
 * レイアウトを完全削除し、デフォルト配置に戻せるようにする。
 * 
 * - 例: ユーザが「レイアウトをリセット」操作を実行した場合に利用
 * - エラー（localStorage 不利用環境など）は黙殺
 */
export function resetLayout(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
