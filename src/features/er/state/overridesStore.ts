import type { Overrides, ColumnOverridePatch } from "../domain/type";

/**
 * LocalStorage 永続化キー
 * - "dg-er-overrides-v1"
 * - 将来の互換性維持のためバージョン suffix を付与している。
 *   破壊的変更を行う際は v2 に切り替えることで古いデータを安全に切り離せる。
 */
const KEY = "dg-er-overrides-v1";

/**
 * loadOverrides
 * -----------------------------------------------------------------------------
 * LocalStorage から列オーバーライド設定を読み込む。
 *
 * 戻り値:
 * - 正常に読み込めた場合: Overrides オブジェクト
 * - LocalStorage が空または JSON 壊れ: 空オブジェクト {}
 *
 * 注意点:
 * - 型チェックは行っていないため、破損データがある場合はランタイム不整合のリスクあり。
 */
export function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

/**
 * saveOverrides
 * -----------------------------------------------------------------------------
 * Overrides を LocalStorage に保存する。
 *
 * 引数:
 * - ov: Overrides オブジェクト
 *
 * 実装上の注意:
 * - JSON.stringify によるシリアライズ。循環参照があると例外になるため注意。
 * - 書き込み失敗 (容量制限 / Safari プライベートモード等) は握りつぶしている。
 *   必要に応じて console.warn を仕込む余地はあるが UX 優先で無音失敗。
 */
export function saveOverrides(ov: Overrides): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ov));
  } catch {
    /* ignore */
  }
}

/**
 * setColumnOverrideLocal
 * -----------------------------------------------------------------------------
 * 特定テーブルの特定列に対するオーバーライド設定を差分適用する。
 * (既存の値を保持しつつ patch をマージ)
 *
 * 引数:
 * - ov: 現在の Overrides
 * - table: テーブル名
 * - col: 列名
 * - patch: ColumnOverridePatch (部分更新したいフィールドのみ指定)
 *
 * 戻り値:
 * - 新しい Overrides (不変更新パターンで返却)
 */
export function setColumnOverrideLocal(
  ov: Overrides,
  table: string,
  col: string,
  patch: ColumnOverridePatch
): Overrides {
  const t = ov[table] ?? {};
  const c = t[col] ?? {};
  return { ...ov, [table]: { ...t, [col]: { ...c, ...patch } } };
}

/**
 * clearTableOverridesLocal
 * -----------------------------------------------------------------------------
 * 特定テーブル全体のオーバーライド設定を削除する。
 *
 * 引数:
 * - ov: 現在の Overrides
 * - table: 削除対象のテーブル名
 *
 * 戻り値:
 * - テーブル設定を削除した新しい Overrides
 */
export function clearTableOverridesLocal(ov: Overrides, table: string): Overrides {
  if (!ov[table]) return ov;
  const n = { ...ov };
  delete n[table];
  return n;
}
