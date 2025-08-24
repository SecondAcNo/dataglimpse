/**
 * Service Layer - Relations Inference
 * ============================================================================
 * テーブル間のリレーション（外部キー関係）を推定する責務を持つサービス。
 *
 * 前提:
 * - SQLite は外部キー制約を明示的に定義していないケースが多い
 * - このサービスは「名前規則」と「データカバレッジ率」を利用して
 *   暗黙的に FK を推定する
 *
 * 責務の境界:
 * - DB アクセスは repo 層（sqliteRepo.runQuery）に委譲
 * - ビジネスロジックとして「どの列が FK か」を判断するのが本サービスの役割
 * - UI 層には Relation[]（ドメイン型）のみを返す
 *
 * アルゴリズム概要:
 * 1. 子テーブル内で `_id` で終わる列を FK 候補とみなす
 * 2. 列名のベース部分を他テーブル名と比較し、候補の親テーブルを抽出
 * 3. 親テーブルの主キー（PK/ユニーク列/全件ユニーク列）を特定
 * 4. 子.col と 親.pk を JOIN し、カバレッジ率 = 一致件数 / 全件数 を計算
 * 5. カバレッジ率が 80%以上なら FK と確定
 *
 * 制約:
 * - 80% は実運用上の経験則。必要に応じて MIN_FK_COVERAGE を調整可能
 * - 複合キーは未対応（単一列キーのみ）
 */

import { runQuery } from "@/features/data/repositories/sqliteRepo";
import type { ColumnMeta, Relation } from "@/features/data/domain/types";

/* ============================================================================
 * 定数・ユーティリティ
 * ==========================================================================*/

const MIN_FK_COVERAGE = 0.8; // FK とみなす最低カバレッジ率（80%）

/** SQL 識別子を安全にクオート */
const Q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

/** 単純な単数形化（不完全だが実用的な範囲で処理） */
const singular = (s: string) =>
  s.endsWith("ies") ? s.slice(0, -3) + "y"
  : s.endsWith("ses") ? s.slice(0, -2)
  : s.endsWith("s")   ? s.slice(0, -1) : s;

/* ============================================================================
 * 親キー候補の特定
 * ==========================================================================*/

/**
 * getParentKey
 * 親テーブルにおけるキー列を推定する。
 * 優先順位:
 *   1. PK 列
 *   2. 名前が "id" の列
 *   3. ユニーク制約を持つ列
 *   4. 実データが全件ユニークな列
 *
 * @param table 親テーブル名
 * @returns キー列名 / 見つからなければ null
 */
async function getParentKey(table: string): Promise<string | null> {
  type TI = { name: string; pk: 0 | 1; notnull: 0 | 1; type: string; cid: number };
  const cols = await runQuery<TI>(`PRAGMA table_info(${Q(table)})`);

  // PK 優先
  const pk = cols.find(c => c.pk === 1)?.name
          ?? cols.find(c => c.name.toLowerCase() === "id")?.name;
  if (pk) return pk;

  // ユニークインデックス
  type IL = { name: string; unique: 0 | 1 };
  const idx = await runQuery<IL>(`PRAGMA index_list(${Q(table)})`);
  const u = idx.find(i => i.unique === 1);
  if (u) {
    type II = { name: string };
    const info = await runQuery<II>(`PRAGMA index_info(${Q(u.name)})`);
    if (info[0]?.name) return info[0].name;
  }

  // 全件ユニーク列を探索
  const [{ c: total }] = await runQuery<{ c: number }>(`SELECT COUNT(*) AS c FROM ${Q(table)}`);
  if (total > 0) {
    for (const c of cols) {
      const [{ d }] = await runQuery<{ d: number }>(
        `SELECT COUNT(DISTINCT ${Q(c.name)}) AS d FROM ${Q(table)} WHERE ${Q(c.name)} IS NOT NULL`
      );
      if (Number(d) === total) return c.name;
    }
  }

  return null;
}

/* ============================================================================
 * リレーション推定本体
 * ==========================================================================*/

/**
 * inferRelations
 * 子テーブルの `_id` 列を起点に親テーブル候補を探索し、FK を推定する。
 *
 * @param table     子テーブル名
 * @param columns   子テーブルの列メタ
 * @param allTables 全テーブル名（自己参照を除外するために利用）
 * @returns Relation[] - 推定されたリレーションの配列（0 件もあり得る）
 */
export async function inferRelations(
  table: string,
  columns: ColumnMeta[],
  allTables: string[]
): Promise<Relation[]> {
  const relations: Relation[] = [];
  const tableL = table.toLowerCase();

  // 子テーブルの FK 候補列 = `_id` で終わる列
  const fkCols = columns.filter(c => /_id$/i.test(c.name));
  if (fkCols.length === 0) return relations;

  for (const col of fkCols) {
    const base = col.name.toLowerCase().replace(/_id$/i, "");

    // 親テーブル候補を名前規則から推定
    const candidates = allTables.filter(t => {
      const tl = t.toLowerCase();
      if (tl === tableL) return false; // 自己参照除外
      return (
        tl === base || tl === base + "s" || tl === base + "es" ||
        singular(tl) === base || tl.startsWith(base) || tl.endsWith(base)
      );
    });

    let best: { parent: string; pk: string; coverage: number } | null = null;

    for (const parent of candidates) {
      const pk = await getParentKey(parent);
      if (!pk) continue;

      // 子.col と 親.pk の一致率を測定
      const [{ matched, total }] = await runQuery<{ matched: number; total: number }>(
        `SELECT 
           SUM(CASE WHEN CAST(p.${Q(pk)} AS TEXT) IS NOT NULL THEN 1 ELSE 0 END) AS matched,
           COUNT(c.${Q(col.name)}) AS total
         FROM ${Q(table)} c
         LEFT JOIN ${Q(parent)} p
           ON CAST(c.${Q(col.name)} AS TEXT) = CAST(p.${Q(pk)} AS TEXT)
         WHERE c.${Q(col.name)} IS NOT NULL`
      );

      const cov = total ? matched / total : 0;

      if (cov >= MIN_FK_COVERAGE && (!best || cov > best.coverage)) {
        best = { parent, pk, coverage: cov };
      }
    }

    if (best) {
      relations.push({
        direction: "child",
        fromTable: table,
        fromColumn: col.name,
        toTable: best.parent,
        toColumn: best.pk,
        joinExample: `SELECT * 
                        FROM ${Q(table)} c 
                        JOIN ${Q(best.parent)} p 
                          ON c.${Q(col.name)} = p.${Q(best.pk)};`,
      });
    }
  }
  return relations;
}
