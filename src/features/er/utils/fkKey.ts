import type { FKTuple, FkTupleLocal, ManualFK } from "../domain/type";

/**
 * FkKeyInput
 * -----------------------------------------------------------------------------
 * `fkKey` 関数で扱える入力の型ユニオン。
 *
 * - FKTuple       ... 自動推定された FK 情報（永続化前）
 * - FkTupleLocal  ... 一時的に UI 側で保持する FK 情報
 * - ManualFK      ... ユーザーが手動追加した FK 情報
 *
 * これらはいずれも `{ fromTable, fromColumn, toTable, toColumn }` を共通プロパティとして持つ。
 * そのため共通のキー生成処理を統一できる。
 */
export type FkKeyInput = FKTuple | FkTupleLocal | ManualFK;

/**
 * fromTo
 * -----------------------------------------------------------------------------
 * 受け取った FK オブジェクトから `{ fromTable, fromColumn, toTable, toColumn }`
 * を抽出するヘルパー。
 *
 * 実装ポイント:
 * - FKTuple / FkTupleLocal / ManualFK は同名プロパティを持つため、型を ManualFK に
 *   アサートして共通的にアクセス。
 * - この処理により、異なる FK 型の入力を透過的に扱える。
 *
 * 制約:
 * - すべての型が `fromTable`, `fromColumn`, `toTable`, `toColumn` を持つことが前提。
 *   もし将来これらの型に差異が生まれた場合は修正が必要。
 */
function fromTo(cols: FkKeyInput) {
  const { fromTable, fromColumn, toTable, toColumn } = cols as ManualFK;
  return { fromTable, fromColumn, toTable, toColumn };
}

/**
 * fkKey
 * -----------------------------------------------------------------------------
 * FK の一意キーを生成する。
 *
 * フォーマット:
 *   "fromTable.fromColumn->toTable.toColumn"
 *
 * 例:
 *   users.role_id -> roles.id
 *   → "users.role_id->roles.id"
 */
export const fkKey = (k: FkKeyInput): string => {
  const { fromTable, fromColumn, toTable, toColumn } = fromTo(k);
  return `${fromTable}.${fromColumn}->${toTable}.${toColumn}`;
};

/**
 * manualEdgeId
 * -----------------------------------------------------------------------------
 * 手動追加された FK に対して、ReactFlow で利用する edge ID を生成する。
 *
 * フォーマット:
 *   "mfk-{fkKey}"
 *
 * 例:
 *   users.role_id -> roles.id
 *   → "mfk-users.role_id->roles.id"
 */
export const manualEdgeId = (fk: ManualFK): string => `mfk-${fkKey(fk)}`;
