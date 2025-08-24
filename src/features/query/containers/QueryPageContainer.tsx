"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import QueryPageView, { type Row, type HistoryItem } from "@/features/query/views/QueryPageView";
import { useResultPaging } from "@/features/query/hooks/useResultPaging";
import { useQueryHistory } from "@/features/query/hooks/useQueryHistory";
import { useQueryExecutor } from "@/features/query/hooks/useQueryExecutor";
import { useSchemaBootstrap } from "@/features/query/hooks/useSchemaBootstrap";
import { useSqlFormatting } from "@/features/query/hooks/useSqlFormatting";
import { useQueryActions } from "@/features/query/hooks/useQueryActions";

/**
 * QueryPageContainer
 * -----------------------------------------------------------------------------
 * - QueryPageView に渡す状態やイベントハンドラを統合するコンテナ
 * - 各ロジックは hooks に分離されており、責務を明確化
 * - View には props を渡すだけにしている
 */
export default function QueryPageContainer() {
  const sp = useSearchParams();
  const initialSql = sp.get("sql") ?? "SELECT 1 AS one"; // 初期SQL（クエリ文字列から取得）

  /** SQL入力状態 */
  const [sql, setSql] = React.useState(initialSql);

  /** 実行結果関連の状態 */
  const [cols, setCols] = React.useState<string[]>([]);    // 結果のカラム名
  const [rows, setRows] = React.useState<Row[]>([]);       // 結果のデータ行
  const [totalRows, setTotalRows] = React.useState<number>(0); // クエリ全体の件数
  const [baseSql, setBaseSql] = React.useState<string>("");    // ページング用の基準SQL

  /** 状態管理（実行中/メッセージ系） */
  const [loading, setLoading] = React.useState(false);         // 実行中フラグ
  const [error, setError] = React.useState<string | null>(null); // エラーメッセージ
  const [info, setInfo] = React.useState<string | null>(null);   // 情報メッセージ

  /** スキーマ情報（テーブル・カラム構造） */
  const { hasTables, schema, refreshSchema } = useSchemaBootstrap();

  /** ページング制御（page, rowsPerPage, データ取得処理） */
  const {
    page,
    rowsPerPage,
    setPage,
    handlePageChange,
    handleRowsPerPageChange,
  } = useResultPaging<Row>({
    baseSql,
    cols,
    totalRows,
    setRows,
    setInfo: (s) => setInfo(s),
    setLoading: (b) => setLoading(b),
  });

  /** 履歴制御（開閉・追加・削除・お気に入りなど） */
  const {
    historyOpen,
    history,
    openHistory,
    closeHistory,
    addHistory,
    toggleFavorite,
    removeHistory,
    clearHistory,
  } = useQueryHistory();

  /** SQL整形処理（手動整形ボタン & 実行前に利用） */
  const { formatting, handleFormat } = useSqlFormatting(sql, setSql);

  /** SQL実行処理（結果セットやスキーマ更新を担当） */
  const { onRun } = useQueryExecutor<Row>({
    sql,
    rowsPerPage,
    onFormat: handleFormat,   // 実行前に整形も可能
    setPage,
    setCols,
    setRows,
    setBaseSql,
    setTotalRows,
    setInfo,
    setLoading,
    setError,
    refreshSchema,   // DDL 実行後の再取得
    addHistory,      // 実行履歴に登録
  });

  /** SQLコピー / CSV出力 / 履歴から反映 or 実行 */
  const { onCopySql, onExportCsv, onHistoryUse, onHistoryRun } = useQueryActions<Row>({
    sql, rows, cols, setSql, onRun,
  });

  /** View に必要な状態・イベントをまとめて渡す */
  return (
    <QueryPageView
      sql={sql}
      formatting={formatting}
      loading={loading}
      hasTables={hasTables}
      cols={cols}
      rows={rows}
      totalRows={totalRows}
      page={page}
      rowsPerPage={rowsPerPage}
      info={info}
      error={error}
      schema={schema}
      historyOpen={historyOpen}
      history={history as HistoryItem[]}
      setSql={setSql}
      onRun={onRun}
      onFormat={handleFormat}
      onCopySql={onCopySql}
      onExportCsv={onExportCsv}
      onPageChange={handlePageChange}
      onRowsPerPageChange={handleRowsPerPageChange}
      openHistory={openHistory}
      closeHistory={closeHistory}
      onHistoryToggleFav={toggleFavorite}
      onHistoryRemove={removeHistory}
      onHistoryClearAll={clearHistory}
      onHistoryUse={onHistoryUse}
      onHistoryRun={onHistoryRun}
    />
  );
}
