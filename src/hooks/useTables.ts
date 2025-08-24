"use client";
import * as React from "react";

/**
 * テーブル一覧の検索・ページング・選択をまとめた Hook
 * - 元データ（tables）は親から渡す（フェッチ責務は page 側のまま）
 */
export function useTables(tables: string[], pageSize = 10) {
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // フィルタ
  const filtered = React.useMemo(
    () => tables.filter(n => n.toLowerCase().includes(filter.toLowerCase())),
    [tables, filter]
  );

  // ページング
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  // フィルタ変更時は1ページ目に戻す
  React.useEffect(() => { setPage(1); }, [filter]);

  // テーブル一覧が変化したらページ数を補正
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // 存在しなくなったテーブルは選択から除外
  React.useEffect(() => {
    setSelected(prev => new Set([...prev].filter(n => tables.includes(n))));
  }, [tables]);

  // 選択操作
  const toggle = React.useCallback((name: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name); else s.add(name);
      return s;
    });
  }, []);
  const selectCurrentPage = React.useCallback(() => {
    setSelected(prev => {
      const s = new Set(prev);
      pageItems.forEach(n => s.add(n));
      return s;
    });
  }, [pageItems]);
  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  return {
    // データ
    filtered,
    pageItems,
    // フィルタ
    filter, setFilter,
    // ページング
    page, setPage, totalPages, start,
    // 選択
    selected, toggle, selectCurrentPage, clearSelection,
  };
}
