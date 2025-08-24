"use client";

import { query, listTables } from "@/lib/sqlite";
import type { ColumnMeta, TableMeta, FKTuple } from "../domain/type";

/**
 * SqliteMetaError
 * =============================================================================
 * - このサービス層で発生した例外を UI レイヤで識別しやすくするための専用エラークラス。
 * - `cause` を保持してチェーン化することでデバッグ容易性を担保。
 * - UI 側では name==="SqliteMetaError" でハンドリング可能。
 */
export class SqliteMetaError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SqliteMetaError";
  }
}

/* ──────────────── PRAGMA 戻り値型（内部専用: SQLite 構造メタ）──────────── */
/**
 * PRAGMA table_info() の戻り行
 * - PK, NOT NULL, デフォルト値など列定義の基本情報
 */
type PragmaTableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: 0 | 1;
};
/** PRAGMA index_list() の戻り行: インデックス一覧 */
type PragmaIndexListRow = {
  seq: number;
  name: string;
  unique: 0 | 1;
  origin: "c" | "u" | "pk";
  partial: 0 | 1;
};
/** PRAGMA index_info() の戻り行: 各インデックスの列情報 */
type PragmaIndexInfoRow = { seqno: number; cid: number; name: string };

/* ──────────────── ユーティリティ ──────────────── */
/**
 * SQL識別子をダブルクォートでエスケープ。
 * - 内部で " を "" に置換し、SQLインジェクションを防止。
 */
const ident = (s: string): string => `"${s.replace(/"/g, '""')}"`;

/**
 * getUniqueColumns
 * -----------------------------------------------------------------------------
 * 単一列ユニーク制約を持つ列を抽出する。
 * - UNIQUE インデックスで単一列のもののみ対象
 * - PK 列も含める
 * - NOT NULL 制約は別で確認するためここでは列挙のみ
 */
export async function getUniqueColumns(table: string): Promise<Set<string>> {
  try {
    const uniques = new Set<string>();
    // インデックス一覧から unique=1 を抽出
    const idxList = await query<PragmaIndexListRow>(`PRAGMA index_list(${ident(table)})`);
    for (const idx of idxList) {
      if (idx.unique !== 1) continue;
      const cols = await query<PragmaIndexInfoRow>(`PRAGMA index_info(${ident(idx.name)})`);
      // 単一列インデックスの場合のみ追加
      if (cols.length === 1 && cols[0] && cols[0].name) uniques.add(cols[0].name);
    }
    // PK 列もユニーク扱い
    const ti = await query<PragmaTableInfoRow>(`PRAGMA table_info(${ident(table)})`);
    for (const c of ti) if (c.pk === 1) uniques.add(c.name);
    return uniques;
  } catch (e) {
    throw new SqliteMetaError(`getUniqueColumns failed: ${table}`, e);
  }
}

/**
 * getTablesMeta
 * -----------------------------------------------------------------------------
 * 全テーブルのメタデータを構築。
 * - 各テーブルごとに PRAGMA table_info() で列定義を取得
 * - getUniqueColumns() でユニーク制約列を補足
 * - ColumnMeta[] に変換
 *
 * 出力: TableMeta[]
 * - name: テーブル名
 * - columns: 各列のメタ（データ型 / PK / Unique+NOTNULL）
 */
export async function getTablesMeta(): Promise<TableMeta[]> {
  try {
    const names = await listTables();
    const out: TableMeta[] = [];
    for (const t of names) {
      const ti = await query<PragmaTableInfoRow>(`PRAGMA table_info(${ident(t)})`);
      const uniques = await getUniqueColumns(t);
      const cols: ColumnMeta[] = ti.map((r) => ({
        name: r.name,
        dataType: r.type || "TEXT", // 型未指定時は TEXT 扱い
        uniqueNoNull: uniques.has(r.name) && r.notnull === 1,
        isPk: r.pk === 1,
      }));
      out.push({ name: t, columns: cols });
    }
    return out;
  } catch (e) {
    throw new SqliteMetaError("getTablesMeta failed", e);
  }
}

/* ──────────────── FK 自動推定（名前類似ヒューリスティクス）─────────────── */
export type InferOptions = {
  /** テーブル名類似スコアの下限（Sorensen–Dice 係数） */
  nameHintMinSim: number;
  /** `id` 単体列を FK 候補から除外するか */
  excludeBareId: boolean;
  /** 自己参照を許可するか */
  allowSelfReference: boolean;
};

/** デフォルト推定オプション */
export const defaultInferOptions: InferOptions = {
  nameHintMinSim: 0.8,
  excludeBareId: true,
  allowSelfReference: false,
};

/* ──────────────── 文字列正規化・類似度計算 ──────────────── */
/** テーブル名/列名を正規化（小文字化、非英数字除去、単複形規格化） */
const normalize = (s: string): string => {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return t
    .replace(/(ies)$/, "y")
    .replace(/(sses|xes|zes|ches|shes)$/, (m) => m.slice(0, -2))
    .replace(/s$/, "");
};
/** Sorensen–Dice 系 bigram セット生成 */
const bigrams = (s: string): Set<string> => {
  if (s.length < 2) return new Set([s]);
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
};
/** Sorensen–Dice 係数で文字列類似度を算出 */
const diceSim = (a: string, b: string): number => {
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const denom = A.size + B.size;
  return denom === 0 ? 0 : (2 * inter) / denom;
};

/**
 * inferForeignKeys
 * -----------------------------------------------------------------------------
 * 列名 `xxx_id` とテーブル名の類似度から FK 候補を自動推定。
 *
 * アルゴリズム:
 * 1. 各テーブルについて、PK/一意列を候補集合に登録
 * 2. 列名が `xxx_id` にマッチする列を抽出
 * 3. xxx と類似度が高いテーブルを探索（Sorensen–Dice ≥ nameHintMinSim）
 * 4. 候補テーブルの一意列が存在すれば FK とみなす
 * 5. `id` 列が存在すれば優先、それ以外は最初の一意列を使用
 *
 * 制約:
 * - excludeBareId = true の場合、列名が単に "id" のものは無視
 * - allowSelfReference = false の場合、自己参照 FK は除外
 */
export async function inferForeignKeys(
  metas: TableMeta[],
  opts?: Partial<InferOptions>
): Promise<FKTuple[]> {
  try {
    const o: InferOptions = { ...defaultInferOptions, ...(opts ?? {}) };
    const normNames = metas.map((t) => ({ table: t.name, n: normalize(t.name) }));

    // テーブルごとの一意キー候補を抽出
    const uniqueMap = new Map<string, Set<string>>();
    for (const t of metas) {
      const s = new Set<string>();
      for (const c of t.columns)
        if (c.isPk || c.name.toLowerCase() === "id" || c.uniqueNoNull) s.add(c.name);
      uniqueMap.set(t.name, s);
    }

    const fks: FKTuple[] = [];
    for (const t of metas) {
      for (const c of t.columns) {
        const lc = c.name.toLowerCase();
        if (o.excludeBareId && lc === "id") continue;

        const m = lc.match(/^(.+)_id$/);
        if (!m) continue; // "_id" サフィックスでなければ対象外

        const base = normalize(m[1]);
        let best: { toTable: string; score: number } | null = null;
        // 類似度最大のテーブルを探索
        for (const cand of normNames) {
          if (!o.allowSelfReference && cand.table === t.name) continue;
          const score = diceSim(base, cand.n);
          if (score >= o.nameHintMinSim && (!best || score > best.score))
            best = { toTable: cand.table, score };
        }
        if (!best) continue;

        // FK先候補の一意列を決定
        const uniqs = uniqueMap.get(best.toTable);
        if (!uniqs || uniqs.size === 0) continue;
        const toColumn = uniqs.has("id") ? "id" : Array.from(uniqs)[0];

        fks.push({ fromTable: t.name, fromColumn: c.name, toTable: best.toTable, toColumn });
      }
    }
    return fks;
  } catch (e) {
    throw new SqliteMetaError("inferForeignKeys failed", e);
  }
}
