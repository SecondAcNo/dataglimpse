"use client";

/**
 * analytics.ts
 * -----------------------------------------------------------------------------
 * ダッシュボードで使う統計/可視化用の「読み取り専用」サービス集。
 *
 * ポリシー
 *  - SQL はすべて識別子を safeIdent() でクオートしてインジェクションを回避。
 *  - パフォーマンスよりも「分かりやすさ」を優先した実装（O(列数) のクエリを多用）。
 *    速度が問題になる場合は、呼び出し頻度の削減・まとめて集計する SQL への書き替え、
 *    インデックス付与（特に *_id 列）などを検討すること。
 */

import { listTables, query } from "@/lib/sqlite";
import { mapAffinity } from "../lib/affinity"; // SQLite の型親和性マッピング（簡易版）
import { safeIdent } from "../lib/schema"; // SQLite の型親和性マッピング（簡易版）

/* ===== Common ================================================================= */
/**
 * ごく簡易な単数化。末尾の 's' を 1 文字だけ剥がす。
 * - users -> user, posts -> post
 * - 日本語等・不規則変化には非対応
 */
function singularize(s: string): string {
  return s.endsWith("s") ? s.slice(0, -1) : s;
}

/* ===== Types ================================================================== */

/** テーブル統計（一覧カード/KPIで使用） */
export type TableStat = {
  name: string;
  rows: number;
  cols: number;
  avgNullRate: number; // 0..1（各列の NULL 率を平均）
  sizeScore: number;   // 行×列の簡易スコア（重さの目安）
};

/** 推定 FK エッジ（子→親） */
export type FkEdge = {
  source: string; // 子テーブル
  target: string; // 親テーブル
  col: string;    // 子テーブルの参照列（*_id 等）
  coverage: number; // 一致率 0..1（NULL を除く）
  matched: number;  // 一致件数
  total: number;    // 分母（子の該当列の非 NULL 件数）
};

/** 列型分布（スタックバー用） */
export type TypeDistRow = {
  table: string;
  INTEGER: number;
  REAL: number;
  NUMERIC: number;
  TEXT: number;
};

/** FK 一致率バー（カード用に整形） */
export type FkCoverageBar = { name: string; coveragePct: number };

/** 列ごとのユニーク率（%） */
export type UniqueRatioRow = { name: string; ratio: number };

/** パレート図の点 */
export type ParetoPoint = { category: string; count: number; cum: number };

/** パレート図に採用した列メタ */
export type ParetoMeta = { table: string; column: string };

/** 相関上位バー */
export type CorrBar = { pair: string; corrAbs: number };

/* ===== Stats ================================================================== */

/**
 * すべてのテーブルについて、行数・列数・平均 NULL 率・サイズスコアを返す。
 *
 * 実装方針:
 *  - 各列ごとに `COUNT(*) - COUNT(col)` で NULL 件数を計算し合算 → 平均。
 *  - O(列数) のクエリを発行するためテーブル/列が多い環境では重くなる可能性あり。
 *    必要なら 1 テーブル内を 1 クエリで集計する SQL へ変更すること。
 */
export async function getTableStats(): Promise<TableStat[]> {
  const names = await listTables();
  const s: TableStat[] = [];

  for (const name of names) {
    // 列一覧
    const cols = await query<{ name: string }>(`PRAGMA table_info(${safeIdent(name)})`);
    const colNames = cols.map(c => c.name);

    // 行数
    const rc = await query<{ c: number }>(`SELECT COUNT(*) AS c FROM ${safeIdent(name)}`);
    const rows = rc[0]?.c ?? 0;

    // 各列の NULL 率を平均
    let nullSum = 0;
    for (const c of colNames) {
      const r = await query<{ n: number }>(
        `SELECT COUNT(*) - COUNT(${safeIdent(c)}) AS n FROM ${safeIdent(name)}`
      );
      const nullCount = r[0]?.n ?? 0;
      nullSum += rows === 0 ? 0 : nullCount / rows;
    }
    const avg = colNames.length ? nullSum / colNames.length : 0;

    s.push({
      name,
      rows,
      cols: colNames.length,
      avgNullRate: avg,
      sizeScore: rows * colNames.length,
    });
  }

  return s;
}

/* ===== FK 推定（*_id / *Id / *ID を許可、8割一致で採用） ====================== */

/**
 * 名前規約ベースで FK を推定する。
 *
 * ルール:
 *  - 子テーブルの列名が `/^(.*?)(?:_?id)$/i` に一致（例: user_id, userId, userID）。
 *  - ただし自テーブルの主キー "id" は除外。
 *  - ベース名（例: user）を単複ゆるく展開（user/users）して、実在するテーブルを親候補に。
 *  - 親 PK は `PRAGMA table_info` の pk=1 を優先、なければ "id" を仮定。
 *  - `LEFT JOIN` で一致率（NULL 除外）を算出し、**8割以上**で採用。
 *
 * 注意:
 *  - 名前規約が守られていない/複合キー/エイリアス FK には反応しない。
 *  - 高速化したい場合は *_id 列と親 PK にインデックスを張ること。
 */
export async function inferFkEdges(tables: string[]): Promise<FkEdge[]> {
  // 小文字 ↔ 元名（大文字小文字ゆらぎ対策）
  const lowerToOrig = new Map(tables.map(n => [n.toLowerCase(), n] as const));
  const tableLowerSet = new Set(lowerToOrig.keys());

  const MIN_COVERAGE = 0.8; // ★ 8割以上で採用
  const edges: FkEdge[] = [];

  for (const child of tables) {
    const cols = await query<{ name: string }>(
      `PRAGMA table_info(${safeIdent(child)})`
    );

    for (const c of cols) {
      const col = c.name;

      // snake/camel 両対応: "user_id" / "userId" / "userID"
      const m = col.match(/^(.*?)(?:_?id)$/i);
      if (!m) continue;

      // 自テーブル主キーらしき "id" 単独は除外
      if (/^id$/i.test(col)) continue;

      // ベース名（末尾の '_' 等は除去）
      const base = m[1].replace(/[_\s]+$/g, "").toLowerCase();
      if (!base) continue;

      // 単複のゆるい展開（users_id, userId など）
      const sg = singularize(base);
      const variants = new Set<string>([base, sg, `${base}s`, `${sg}s`]);

      // 実在する親テーブル候補（元名へ解決）
      const parents: string[] = [];
      for (const v of variants) if (tableLowerSet.has(v)) parents.push(lowerToOrig.get(v)!);
      if (parents.length === 0) continue;

      for (const parent of parents) {
        // 親 PK （pk=1 優先、なければ "id" を仮定）
        const pcols = await query<{ name: string; pk: number }>(
          `PRAGMA table_info(${safeIdent(parent)})`
        );
        const pkCol = pcols.find(pc => pc.pk === 1)?.name ?? "id";

        // カバレッジ（子 NULL は分母から除外）
        const res = await query<{ matched: number; total: number }>(
          `SELECT 
             SUM(CASE WHEN p.${safeIdent(pkCol)} IS NOT NULL THEN 1 ELSE 0 END) AS matched,
             COUNT(c.${safeIdent(col)}) AS total
           FROM ${safeIdent(child)} c
           LEFT JOIN ${safeIdent(parent)} p
             ON c.${safeIdent(col)} = p.${safeIdent(pkCol)}
           WHERE c.${safeIdent(col)} IS NOT NULL`
        );

        const matched = res[0]?.matched ?? 0;
        const total = res[0]?.total ?? 0;
        if (total === 0) continue;

        const coverage = matched / total;

        if (coverage >= MIN_COVERAGE) {
          edges.push({ source: child, target: parent, col, coverage, matched, total });
          // 同一子列で複数親候補が当たる場合は最初の有力候補だけ採用
          break;
        }
      }
    }
  }

  // 信頼度高い順
  return edges
    .sort((a, b) => b.coverage - a.coverage || b.matched - a.matched)
    .slice(0, 30);
}

/* ===== 集計作成 =============================================================== */

/**
 * 各テーブルの列型分布（INTEGER/REAL/NUMERIC/TEXT の件数）を返す。
 * 上位 5 テーブルを返却。
 *
 * 備考:
 *  - SQLite は列「宣言型」から親和性を決めるため、PRAGMA の type を mapAffinity で粗く解釈。
 *  - PRAGMA の type が空のケースもあるが、mapAffinity は TEXT を返すため安全。
 */
export async function buildTypeDistribution(tables: string[]): Promise<TypeDistRow[]> {
  const out: TypeDistRow[] = [];

  for (const t of tables) {
    const cols = await query<{ name: string; type: string }>(
      `PRAGMA table_info(${safeIdent(t)})`
    );

    const row: TypeDistRow = { table: t, INTEGER: 0, REAL: 0, NUMERIC: 0, TEXT: 0 };
    cols.forEach(c => { row[mapAffinity(c.type)]++; });
    out.push(row);
  }

  return out
    .sort(
      (a, b) =>
        (b.INTEGER + b.REAL + b.NUMERIC + b.TEXT) -
        (a.INTEGER + a.REAL + a.NUMERIC + a.TEXT)
    )
    .slice(0, 5);
}

/**
 * FK エッジ配列をバー表示用に整形。
 * 例: "orders.user_id→users.id" のようなラベルにして coverage を % 丸め。
 */
export function edgesToCoverageBars(edges: FkEdge[]): FkCoverageBar[] {
  return edges
    .slice(0, 7)
    .map(e => ({
      name: `${e.source}.${e.col}→${e.target}.id`,
      coveragePct: +(e.coverage * 100).toFixed(2),
    }));
}

/**
 * 列ごとのユニーク率上位を返す（%）。
 * DISTINCT / 行数 × 100 を各列で計算し、上位 8 を返却。
 *
 * 注意:
 *  - O(列数) のクエリを発行（COUNT(DISTINCT col)）。大規模環境ではコスト高。
 *  - 非 NULL のみに限定したい場合は WHERE 句を追加すること。
 */
export async function buildUniqueRatioTop(tables: string[]): Promise<UniqueRatioRow[]> {
  const out: UniqueRatioRow[] = [];

  for (const t of tables) {
    const cols = await query<{ name: string }>(
      `PRAGMA table_info(${safeIdent(t)})`
    );

    const rc = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ${safeIdent(t)}`
    );
    const rows = rc[0]?.c ?? 0;
    if (rows === 0) continue;

    for (const c of cols) {
      const r = await query<{ d: number }>(
        `SELECT COUNT(DISTINCT ${safeIdent(c.name)}) AS d
           FROM ${safeIdent(t)}
          WHERE ${safeIdent(c.name)} IS NOT NULL`
      );
      const d = r[0]?.d ?? 0;
      out.push({ name: `${t}.${c.name}`, ratio: +((d / rows) * 100).toFixed(2) });
    }
  }

  return out.sort((a, b) => b.ratio - a.ratio).slice(0, 8);
}

/**
 * パレート図（上位カテゴリと累積比）を構築。
 *
 * 手順:
 *  1) TEXT 親和性の列を候補にする。
 *  2) DISTINCT の件数が [3, 50] の列を対象に（分類として適度な粒度）。
 *  3) 上位 12 値の頻度を取り、累積比（%）を計算して返す。
 * 成功した最初の列で確定して返却（1 つ見つかれば十分という UX）。
 */
export async function buildPareto(
  tables: string[]
): Promise<{ data: ParetoPoint[]; meta?: ParetoMeta }> {
  for (const t of tables) {
    const cols = await query<{ name: string; type: string }>(
      `PRAGMA table_info(${safeIdent(t)})`
    );
    const catCols = cols
      .map(c => ({ name: c.name, aff: mapAffinity(c.type) }))
      .filter(c => c.aff === "TEXT");

    for (const c of catCols) {
      // DISTINCT 件数
      const uniq = await query<{ d: number }>(
        `SELECT COUNT(DISTINCT ${safeIdent(c.name)}) AS d FROM ${safeIdent(t)}`
      );
      const d = uniq[0]?.d ?? 0;
      if (d < 3 || d > 50) continue;

      // 上位 12
      const top = await query<{ v: string; c: number }>(
        `SELECT ${safeIdent(c.name)} AS v, COUNT(*) AS c
           FROM ${safeIdent(t)}
          WHERE ${safeIdent(c.name)} IS NOT NULL
          GROUP BY ${safeIdent(c.name)}
          ORDER BY c DESC
          LIMIT 12`
      );
      if (top.length === 0) continue;

      // 非 NULL 総数
      const totalR = await query<{ c: number }>(
        `SELECT COUNT(*) AS c FROM ${safeIdent(t)} WHERE ${safeIdent(c.name)} IS NOT NULL`
      );
      const total = totalR[0]?.c ?? 0;

      // 累積比
      let cum = 0;
      const data = top.map(row => {
        cum += row.c;
        return {
          category: row.v ?? "(null)",
          count: row.c,
          cum: +((cum / total) * 100).toFixed(2),
        };
      });

      return { data, meta: { table: t, column: c.name } };
    }
  }
  return { data: [], meta: undefined };
}

/**
 * 数値列（INTEGER/REAL）からピアソン相関の上位ペアを返す。
 * 1 テーブルを対象に、最大 5,000 行を取得して計算（メモリ内）。
 *
 * 選択ルール:
 *  - 最も数値列の多いテーブルを 1 つ選ぶ（列数 >= 2）。
 *  - 5,000 行までを SELECT（ざっくりで十分な可視化用）。
 *  - NaN/∞ は無視して相関を計算。
 */
export async function buildCorrelationTop(tables: string[]): Promise<CorrBar[]> {
  let target: string | undefined;
  let numCols: { name: string }[] = [];

  // 数値列が多いテーブルを選ぶ
  for (const t of tables) {
    const cols = await query<{ name: string; type: string }>(
      `PRAGMA table_info(${safeIdent(t)})`
    );
    const nums = cols
      .filter(c => {
        const a = mapAffinity(c.type);
        return a === "INTEGER" || a === "REAL";
      })
      .map(c => ({ name: c.name }));

    if (nums.length >= 2 && nums.length > numCols.length) {
      target = t;
      numCols = nums;
    }
  }

  if (!target || numCols.length < 2) return [];

  // データ取得（サンプリング上限 5000）
  const selectCols = numCols.map(c => safeIdent(c.name)).join(", ");
  const rows = await query<Record<string, number>>(
    `SELECT ${selectCols} FROM ${safeIdent(target!)} LIMIT 5000`
  );
  if (rows.length === 0) return [];

  // 列ごとの配列へ整形（NaN はスキップ対象）
  const colsArr = numCols.map(c => c.name);
  const series: Record<string, number[]> = {};
  colsArr.forEach(n => { series[n] = []; });
  rows.forEach(r => {
    colsArr.forEach(n => {
      const v = r[n];
      series[n].push((typeof v === "number" && isFinite(v)) ? v : NaN);
    });
  });

  // ピアソン相関（NaN を無視）
  function pearson(a: number[], b: number[]): number {
    const n = a.length;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i], y = b[i];
      if (!isFinite(x) || !isFinite(y)) continue;
      m++;
      sx += x; sy += y;
      sxx += x * x; syy += y * y;
      sxy += x * y;
    }
    if (m < 3) return 0; // サンプル少なすぎ
    const cov = sxy - (sx * sy) / m;
    const vx = sxx - (sx * sx) / m;
    const vy = syy - (sy * sy) / m;
    if (vx <= 0 || vy <= 0) return 0; // 定数列など
    return cov / Math.sqrt(vx * vy);
  }

  // すべてのペアを計算し、|r| が大きい順に上位 8 件
  const out: CorrBar[] = [];
  for (let i = 0; i < colsArr.length; i++) {
    for (let j = i + 1; j < colsArr.length; j++) {
      const c = Math.abs(pearson(series[colsArr[i]], series[colsArr[j]]));
      out.push({
        pair: `${target}.${colsArr[i]}×${colsArr[j]}`,
        corrAbs: +(c * 100).toFixed(1),
      });
    }
  }
  return out.sort((a, b) => b.corrAbs - a.corrAbs).slice(0, 8);
}
