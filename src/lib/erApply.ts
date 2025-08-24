import type { Overrides } from "./erOverrides";

// 既存の型に合わせて調整
export type ColumnMeta = { name: string; dataType: string; uniqueNoNull: boolean; isPk?: boolean; };
export type TableMeta  = { name: string; columns: ColumnMeta[]; };

export function applyOverrides(tables: TableMeta[], ov: Overrides): TableMeta[] {
  // ディープコピーしてから適用
  return tables.map(tbl => {
    const tOv = ov[tbl.name] || {};
    const cols = tbl.columns.map(col => {
      const cOv = tOv[col.name] || {};
      return {
        ...col,
        // 優先順位：手動 isPk → 自動（既にあれば）→ undefined
        isPk: typeof cOv.isPk === "boolean" ? cOv.isPk : col.isPk,
        // Unique も上書き（uniqueNoNull を見ているなら、表示用に isUnique を別途持つ）
        uniqueNoNull: typeof cOv.isUnique === "boolean" ? cOv.isUnique : col.uniqueNoNull,
        // 表示で "Unique" フラグ名を使いたい場合:
        isUnique: typeof cOv.isUnique === "boolean" ? cOv.isUnique : col.uniqueNoNull,
      } as ColumnMeta & { isUnique?: boolean };
    });
    return { ...tbl, columns: cols };
  });
}
