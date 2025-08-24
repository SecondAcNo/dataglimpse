/**
 * schema.ts
 * -----------------------------------------------------------------------------
 * このコードは「CSVなどの外部データをSQLiteに安全に取り込むための基盤」です。
 * - 安全化: 識別子・リテラルをエスケープしてインジェクションを防止
 * - 正規化: ファイル名をDBテーブル名に変換
 * - 型推論: データを解析して最適な SQLite 親和性を決定
 * - 制約推定: NOT NULL・UNIQUE・主キー候補を自動抽出
 * - 挿入処理: 値をSQLリテラルに安全変換
 *
 * 変更点:
 * - Affinity / mapAffinity は affinity.ts に一元化
 * - safeIdent は sqliteUtils.ts に集約
 * - 互換性維持のため当ファイルから re-export する
 */

import { Affinity } from "./affinity";

/**
 * ファイル名から安全なテーブル名を生成。
 * ポータブル性（PostgreSQL 等 63 文字制限）を意識しつつ、SQLite でも問題ない形に整形。
 *
 * 手順:
 *  1) 拡張子除去
 *  2) NFKD 正規化（濁点・合成文字の分解）
 *  3) 英数・アンダースコア以外を `_` に置換（※ \w は ASCII 想定）
 *  4) 先頭が英字/アンダースコア以外なら削除（識別子の先頭規則）
 *  5) 空なら "table"（衝突リスクは後段 ensureUniqueTableName で回避想定）
 *  6) 63 文字に切詰め（PostgreSQL 互換の慣習）
 *  7) 小文字化
 *
 * 将来改善:
 *  - 国際化を強く意識する場合は `\p{L}\p{N}` を使う Unicode 正規表現へ移行。
 */
export function toSafeTableNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  let s = base.normalize("NFKD").replace(/[^\w]+/g, "_");
  s = s.replace(/^[^A-Za-z_]+/, "");
  if (!s) s = "table";
  if (s.length > 63) s = s.slice(0, 63);
  return s.toLowerCase();
}

/**
 * テーブル名のユニーク化を保証。
 *
 * @param base ユーザー希望のベース名（整形済みを想定）
 * @param existingGetter 既存テーブル名一覧を返す非同期関数（大文字小文字は非区別化される）
 * @returns ユニークなテーブル名（例: base, base_2, base_3, ...）
 *
 * 注意:
 *  - 競合が極めて多いワークロードでは _N が大きくなる可能性あり。
 *    必要に応じて上限やランダムサフィックス導入を検討。
 */
export async function ensureUniqueTableName(
  base: string,
  existingGetter: () => Promise<string[]>
): Promise<string> {
  const existing = new Set((await existingGetter()).map((n) => n.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let i = 2;
  for (;;) {
    const cand = `${base}_${i}`;
    if (!existing.has(cand.toLowerCase())) return cand;
    i++;
  }
}

/* ========= 型判定・正規表現ユーティリティ =========
 *  - intRe:     整数（符号付き、先頭ゼロ許容）
 *  - realRe:    浮動小数（小数/指数部いずれも対応）
 *  - boolTrue/False: ブール表現（ケース非区別、ロケール非依存）
 *  - dateRe:    ISO 8601 風の日付/日時（YYYY-MM-DD[ HH:MM[:SS]][Z|±HH:MM]）
 *                ※ 厳密検証ではない。フォーマット形状チェックに留める。
 */
const intRe = /^[+-]?\d+$/;
const realRe = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/;
const boolTrue = new Set(["true", "1", "yes", "y", "t"]);
const boolFalse = new Set(["false", "0", "no", "n", "f"]);
const dateRe = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * 推論された列メタデータ。
 * - affinity:   SQLite 親和性（保存時/DDL 生成の基礎）
 * - notNull:    空文字（トリム後）を含まないか
 * - unique:     観測行範囲で重複無しか（= 一意制約候補）
 * - isBool:     真偽値表現が 95% 以上占めるか（ストレージは INTEGER）
 * - isDateLike: 日付/日時形状が 80% 以上占めるか（ストレージは NUMERIC）
 */
export type InferredCol = {
  name: string;
  affinity: Affinity;
  notNull: boolean;
  unique: boolean;
  isBool: boolean;
  isDateLike: boolean;
};

/**
 * サンプル行から各列の型・制約候補を推論。
 *
 * アルゴリズム概要（列ごとに O(n)）:
 *  - 空文字（トリム後）を NULL 値として扱い、非 NULL 件数をカウント
 *  - int/real/bool/date のヒット件数を集計
 *  - 閾値ベースで affinity / isBool / isDateLike を決定
 *  - 観測範囲での uniqueness を判定（Set のサイズ == 非 NULL 件数）
 *  - 主キー候補は以下のヒューリスティクス:
 *      * 列名が id または <table>_id
 *      * notNull かつ unique
 *      * affinity が INTEGER or TEXT（UUID 等も想定）
 *
 * 注意:
 *  - サンプリングに基づくため、全データでの厳密保証はしない（大規模データは誤判定の可能性）。
 *  - 閾値は固定値（bool:95%, date:80%）。必要なら外出し定数化して調整可能に。
 */
export function inferSchema(
  rows: Record<string, string>[],
  headers: string[],
  table: string
): { cols: InferredCol[]; pk?: string; uniqueCols: string[] } {
  const cols: InferredCol[] = [];
  const uniqueCols: string[] = [];
  const pkCandidates: string[] = [];

  for (const h of headers) {
    const seen = new Set<string>();
    // 統計カウンタ
    let nonNull = 0, asInt = 0, asReal = 0, asBool = 0, asDate = 0, empty = 0;

    for (const r of rows) {
      const raw = (r[h] ?? "").toString().trim();
      if (raw === "") { empty++; continue; } // 空文字は NULL 相当として扱う
      nonNull++;

      const lower = raw.toLowerCase();
      if (boolTrue.has(lower) || boolFalse.has(lower)) asBool++;
      if (intRe.test(raw)) asInt++;
      else if (realRe.test(raw)) asReal++;
      if (dateRe.test(raw)) asDate++;

      seen.add(raw); // uniqueness 判定用
    }

    // 既定は TEXT。観測結果に応じて上書き
    let affinity: Affinity = "TEXT";
    let isBool = false;
    let isDateLike = false;

    if (nonNull > 0) {
      // 真偽 95% 以上なら INTEGER ストレージで表現（0/1）
      if (asBool / nonNull >= 0.95) { affinity = "INTEGER"; isBool = true; }
      // 全件が整数 → INTEGER
      else if (asInt === nonNull) affinity = "INTEGER";
      // 全件が数値（整数 or 実数） → REAL
      else if ((asInt + asReal) === nonNull) affinity = "REAL";
      // 日付形状が 80% 以上 → NUMERIC（SQLite 流儀的に格納）
      else if (asDate / nonNull >= 0.8) { affinity = "NUMERIC"; isDateLike = true; }
    }

    const notNull = empty === 0;
    const unique = nonNull > 0 && seen.size === nonNull;

    if (unique && notNull) uniqueCols.push(h);

    // 主キー候補（ヒューリスティクス）
    const lname = h.toLowerCase();
    const baseName = table.toLowerCase();
    const idLike = lname === "id" || lname === `${baseName}_id`;
    if (idLike && unique && notNull && (affinity === "INTEGER" || affinity === "TEXT")) {
      pkCandidates.push(h);
    }

    cols.push({ name: h, affinity, notNull, unique, isBool, isDateLike });
  }

  // 最優先候補を採用。見つからなければ "id INTEGER NOT NULL" のような典型列を探す。
  let pk: string | undefined = pkCandidates[0];
  if (!pk) {
    const idCol = cols.find(c =>
      c.name.toLowerCase() === "id" && c.notNull && c.affinity === "INTEGER"
    );
    if (idCol) pk = idCol.name;
  }

  return { cols, pk, uniqueCols };
}

/**
 * 文字列（CSV/外部入力）を、推論済み列メタに基づき SQL リテラルへ安全変換。
 *
 * ルール:
 *  - 空文字は NULL
 *  - isBool は true 系 → "1", false 系 → "0", それ以外は NULL（曖昧さ回避）
 *  - INTEGER/REAL は妥当な形状なら素の数値を返却（クオートしない）
 *  - その他はシングルクオートで囲み、内部の `'` を `''` にエスケープ
 *
 * 注意:
 *  - isDateLike であっても厳密変換は行わず TEXT 互換のまま保存（NUMERIC 親和性想定）。
 *    必要に応じて正規化（例: UTC ISO 文字列への変換）を上位で実装すること。
 */
export function toSqlLiteral(raw: string | undefined, col: InferredCol): string {
  const v = (raw ?? "").toString().trim();
  if (v === "") return "NULL";

  if (col.isBool) {
    const lower = v.toLowerCase();
    if (boolTrue.has(lower)) return "1";
    if (boolFalse.has(lower)) return "0";
    return "NULL"; // ブール不明確は NULL にフォールバック
  }

  if (col.affinity === "INTEGER" && intRe.test(v)) return v;
  if (col.affinity === "REAL" && (intRe.test(v) || realRe.test(v))) return v;

  // TEXT/NUMERIC などはクオート。内部の ' を '' にエスケープ
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * 識別子（テーブル名・カラム名など）を SQLite 用に安全化する。
 *
 * - ダブルクオート `"` で囲み、内部の `"` は `""` へエスケープ。
 * - 値リテラルではなく「識別子」向けのクオートである点に注意（'...' ではない）。
 * - SQL Injection や予約語の衝突回避に有効。
 *
 * @param name 任意の識別子（ユーザー入力含む）
 * @returns SQLite で安全に利用可能な識別子文字列
 *
 * @example
 * safeIdent("user")          // => `"user"`
 * safeIdent("a\"b")          // => `"a""b"`
 */
export function safeIdent(name: string): string {
  // 既存の `"` を `""` に置換して安全化
  return `"${name.replace(/"/g, '""')}"`;
}
