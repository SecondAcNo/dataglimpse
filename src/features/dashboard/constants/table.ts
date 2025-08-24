/**
 *   table.ts - 一覧ページング/確認ダイアログのUX定数
 *
 * - PAGE_SIZE_DEFAULT:
 *   1ページの行数初期値。モバイル視認性と初回レンダリング負荷のバランスで 10 を採用。
 *   ※変更時は Pagination・「表示範囲ラベル」の表示崩れと体感速度を確認すること。
 *
 * - CONFIRM_LIST_PREVIEW_MAX:
 *   削除確認ダイアログで個別名を列挙する上限。
 *   超過分は「…他 N 件」で省略し、モーダルの縦伸び/スクロール発生を防止。
 */

export const PAGE_SIZE_DEFAULT = 10;         // 一覧の1ページ件数
export const CONFIRM_LIST_PREVIEW_MAX = 10;  // 削除ダイアログで列挙する最大件数
