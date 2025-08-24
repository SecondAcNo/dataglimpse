import * as T from "../domain/type";

/**
 * buildNameBasedBadgeByTable
 * =============================================================================
 * 「列名から自動的に外部キー（FK）候補を推定する」ためのユーティリティ。
 * 
 * アルゴリズム概要:
 * - 列名が `xxx_id` の形式に一致する場合のみ対象とする
 * - その `xxx` 部分を正規化（小文字化・不要文字削除・語尾の単数化）
 * - 正規化したテーブル名一覧と `xxx` の Dice係数（文字バイグラムの類似度）を計算
 * - 類似度が `minDiceSim` 以上なら「FKバッジ ON」の初期候補とみなす
 *
 * 返却値:
 * - Map<tableName, Set<columnName>>
 *   → テーブルごとに「FKバッジをデフォルトONにすべき列集合」を返す
 */
export function buildNameBasedBadgeByTable(
  tablesMeta: T.TableMeta[],
  opts?: { minDiceSim?: number }
): Map<string, Set<string>> {
  const minDiceSim = opts?.minDiceSim ?? 0.8;

  // ---------------------------------------------------------------------------
  // 正規化関数: 大文字小文字の揺れや語尾の複数形を吸収
  // - 例: "Categories" → "category", "Boxes" → "box"
  // ---------------------------------------------------------------------------
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")      // 英数字以外を除去
      .replace(/(ies)$/, "y")         // categories → category
      .replace(/(sses|xes|zes|ches|shes)$/, (m) => m.slice(0, -2)) // boxes → box
      .replace(/s$/, "");             // products → product

  // ---------------------------------------------------------------------------
  // 文字列をバイグラム集合に変換
  // - Dice係数の計算に利用
  // - 長さ1なら単文字集合を返す
  // ---------------------------------------------------------------------------
  const bigrams = (s: string): Set<string> => {
    if (s.length < 2) return new Set([s]);
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };

  // ---------------------------------------------------------------------------
  // Dice係数 (2|A∩B| / (|A|+|B|))
  // - 文字バイグラム集合の類似度を数値化
  // ---------------------------------------------------------------------------
  const dice = (a: string, b: string): number => {
    const A = bigrams(a);
    const B = bigrams(b);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const denom = A.size + B.size;
    return denom === 0 ? 0 : (2 * inter) / denom;
  };

  // ---------------------------------------------------------------------------
  // テーブルごとに「推定FKバッジ列」を構築
  // ---------------------------------------------------------------------------
  const map = new Map<string, Set<string>>();
  const normTableNames = tablesMeta.map((t) => ({ name: t.name, n: normalize(t.name) }));

  for (const t of tablesMeta) {
    const set = new Set<string>();
    for (const col of t.columns) {
      // 対象: *_id 形式の列のみ
      const m = col.name.toLowerCase().match(/^(.+)_id$/);
      if (!m) continue;

      const base = normalize(m[1]);
      if (base === "id") continue; // 汎用的な "id" は除外 (自己参照扱いを避ける)

      // テーブル名との類似度判定
      if (normTableNames.some((tt) => dice(base, tt.n) >= minDiceSim)) {
        set.add(col.name);
      }
    }
    map.set(t.name, set);
  }
  return map;
}
