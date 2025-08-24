import type { EdgeStyleMap } from "../domain/type";

/**
 * Edge Style 設定の LocalStorage 永続化キー
 * - バージョン番号を suffix に付与しておくことで、将来の schema 変更時に
 *   互換性崩壊を回避しやすくする（v2 にすれば旧データを無視できる）。
 */
const KEY = "dg-er-edge-style-map-v1";

/**
 * loadEdgeStyleMap
 * -----------------------------------------------------------------------------
 * LocalStorage からエッジスタイル設定を読み込む。
 *
 * 戻り値:
 * - 正常に JSON がパースできた場合: EdgeStyleMap
 * - 値が存在しない or JSON パースに失敗した場合: 空オブジェクト {}
 *
 * 注意点:
 * - LocalStorage が利用不可（Safari プライベートモードや SSR 環境など）の場合、
 *   例外をキャッチして安全に {} を返す。
 * - 型アサーションを利用しているため、実際のデータ構造が壊れていると
 *   実行時エラーの可能性がある → 将来的に schema バリデーション導入を検討可。
 */
export function loadEdgeStyleMap(): EdgeStyleMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as EdgeStyleMap;
  } catch {
    return {};
  }
}

/**
 * saveEdgeStyleMap
 * -----------------------------------------------------------------------------
 * EdgeStyleMap を LocalStorage に保存する。
 *
 * 引数:
 * - m: EdgeStyleMap (エッジごとのスタイル設定: 色・線種など)
 *
 * 振る舞い:
 * - JSON.stringify でシリアライズして保存
 * - 書き込みに失敗（容量制限やブラウザの制約など）の場合は無視
 *
 * 注意点:
 * - 無音失敗（catch 内で何もしない）にしているため、
 *   デバッグ時は console.warn などを追加する余地あり。
 * - 書き込みが頻繁すぎるとパフォーマンス/寿命に影響するため、
 *   呼び出し頻度は適切に制御することが望ましい。
 */
export function saveEdgeStyleMap(m: EdgeStyleMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
