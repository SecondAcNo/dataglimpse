"use client";

/**
 * useTableSelection
 * -----------------------------------------------------------------------------
 * テーブル一覧の「検索・ページング・選択」をまとめて管理するフック。
 */

import * as React from "react";
import type { TableListItem } from "@/features/dashboard/components/TableListPanel";
import type { TableStat } from "@/features/dashboard/services/analytics";

//このフックが返す状態と操作のセットを定義
type Return = {
  // --- 検索 & ページング ---
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>; // 入力欄から直接渡せるSetter
  page: number;                   // 1始まりのページ番号
  setPage: (p: number) => void;   // ページャから呼ぶ（numberのみ受け付ける簡易型）
  totalPages: number;             // 総ページ数（最低1）
  startIndex: number;             // 今ページの先頭（1始まり、0件の時は0）
  filteredCount: number;          // フィルタ後の総件数
  pageItems: TableListItem[];     // 画面に描画する1ページ分の行

  // --- 選択（チェックボックス） ---
  selected: Set<string>;          // 選択中のテーブル名集合
  toggleSelect: (name: string) => void; // 単一行のトグル
  selectPage: () => void;               // 今ページの全行を選択に追加
  clearSelection: () => void;           // 全解除
};

/**
 * useTableSelection
 * -----------------------------------------------------------------------------
 * テーブル一覧の「検索・ページング・選択」をまとめて管理するフック。
 *
 * @param tables  全テーブル名の配列
 * @param stats   各テーブルの統計（行数/列数）
 * @param pageSize 1ページの件数（既定: 10）
 * @returns Return UIがそのまま使える状態と操作群
 */
export default function useTableSelection(
  tables: string[],
  stats: TableStat[],
  pageSize = 10
): Return {
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // tables が変わったら選択を健全化
  React.useEffect(() => {
    setSelected(prev => new Set([...prev].filter(n => tables.includes(n))));
  }, [tables]);

  // フィルタ＆ページング
  const filtered = React.useMemo(
    () => tables.filter(n => n.toLowerCase().includes(filter.toLowerCase())),
    [tables, filter]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageNames = filtered.slice(start, start + pageSize);

  React.useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  React.useEffect(() => { setPage(1); }, [filter]);

  // 表示用アイテム
  const statMap = React.useMemo(() => new Map(stats.map(s => [s.name, s])), [stats]);
  const pageItems: TableListItem[] = React.useMemo(
    () => pageNames.map(name => {
      const st = statMap.get(name);
      return { name, rows: st?.rows ?? 0, cols: st?.cols ?? 0 };
    }),
    [pageNames, statMap]
  );

  // 選択操作
  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name); else s.add(name);
      return s;
    });
  };
  const selectPage = () => {
    setSelected(prev => {
      const s = new Set(prev);
      pageNames.forEach(n => s.add(n));
      return s;
    });
  };
  const clearSelection = () => setSelected(new Set());

  return {
    filter, setFilter,
    page, setPage,
    totalPages,
    startIndex: filtered.length === 0 ? 0 : start + 1,
    filteredCount: filtered.length,
    pageItems,
    selected, toggleSelect, selectPage, clearSelection,
  };
}
