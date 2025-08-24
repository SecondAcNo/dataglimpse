import type { ManualFK } from "../domain/type";

/**
 * LocalStorage 永続化用キー
 * - "dg-er-manual-fks-v1"
 * - バージョン番号を suffix に付与することで将来の schema 変更に備える。
 *   v2 へ移行した際に古いデータを無視できるようにする設計。
 */
const KEY = "dg-er-manual-fks-v1";

/**
 * loadManualFKs
 * -----------------------------------------------------------------------------
 * LocalStorage から手動で追加された外部キー (ManualFK) 一覧を読み込む。
 *
 * 戻り値:
 * - 正常にパースできた場合: ManualFK[] 配列
 * - 値が存在しない、あるいは JSON が壊れている場合: 空配列 []
 *
 * 実装上の注意:
 * - localStorage.getItem が null の場合に備えて "[]" をデフォルトとする。
 * - JSON.parse が失敗する可能性があるため try-catch で安全にフォールバック。
 * - 型アサーションを利用しているため、内容が壊れている場合は
 *   実行時エラーや不整合を引き起こすリスクがある。
 */
export function loadManualFKs(): ManualFK[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ManualFK[];
  } catch {
    return [];
  }
}

/**
 * saveManualFKs
 * -----------------------------------------------------------------------------
 * 手動で追加された外部キー (ManualFK) 一覧を LocalStorage に保存する。
 *
 * 引数:
 * - fks: ManualFK[] (ユーザーが明示的に設定した外部キーのリスト)
 *
 * 実装上の注意:
 * - JSON.stringify により配列をシリアライズして保存。
 * - 保存失敗 (容量制限 / ブラウザ制約) の場合は無視してアプリを継続。
 *   デバッグ用に console.warn を入れるオプションはあるが、
 *   UX 優先で無音失敗としている。
 */
export function saveManualFKs(fks: ManualFK[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(fks));
  } catch {
    /* ignore */
  }
}
