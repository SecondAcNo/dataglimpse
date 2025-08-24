"use client";

import * as React from "react";
import * as T from "../domain/type";
import { getTablesMeta, inferForeignKeys } from "../services/sqliteMeta";

/**
 * useMetaLoader
 * =============================================================================
 * SQLite のメタ情報（テーブル構造・自動推定FK）をロードするカスタムフック。
 *
 * 主な責務:
 * - SQLite に問い合わせてテーブルメタ情報を取得
 * - テーブル間の外部キーを自動推定（ヒューリスティック）
 * - 呼び出し側に状態 (ロード中 / エラー / 空) とリロード関数を提供
 */
export function useMetaLoader() {
  // ---------------------------------------------------------------------------
  // 1. 状態管理
  // ---------------------------------------------------------------------------
  const [tablesMeta, setTablesMeta] = React.useState<T.TableMeta[] | null>(null); // テーブル構造一覧
  const [autoFks, setAutoFks] = React.useState<T.FKTuple[]>([]);                  // 推定外部キー
  const [loading, setLoading] = React.useState(true);                             // ロード中フラグ
  const [error, setError] = React.useState<string | null>(null);                  // エラー内容
  const [empty, setEmpty] = React.useState(false);                                // DBが空かどうか

  // ---------------------------------------------------------------------------
  // 2. リロード関数
  //    - DBメタ情報を再取得し、外部キーを推定
  //    - 例外処理で error / empty を適切に設定
  // ---------------------------------------------------------------------------
  const reload = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEmpty(false);

      // --- テーブルメタを取得 ---
      const metas = await getTablesMeta();
      if (metas.length === 0) {
        // DBにテーブルが存在しない → 空状態
        setEmpty(true);
        setTablesMeta([]);
        setAutoFks([]);
        return;
      }

      // --- 外部キーをヒューリスティックで推定 ---
      // nameHintMinSim:   列名の類似度閾値（0.8以上でFK候補とみなす）
      // excludeBareId:    "id" のような汎用列名は除外（誤検知を防止）
      // allowSelfReference: false → 自己参照FKは除外（通常は不要）
      const fks = await inferForeignKeys(metas, {
        nameHintMinSim: 0.8,
        excludeBareId: true,
        allowSelfReference: false,
      });

      setTablesMeta(metas);
      setAutoFks(fks);
    } catch (e) {
      // エラーメッセージを文字列化して保存（UIで表示可能にする）
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 3. 初回ロード
  //    - マウント時に自動でリロードを実行
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    void reload();
  }, [reload]);

  // ---------------------------------------------------------------------------
  // 4. 公開API
  //    - 呼び出し元が利用できる状態と操作を返却
  // ---------------------------------------------------------------------------
  return { tablesMeta, autoFks, loading, error, empty, reload };
}
