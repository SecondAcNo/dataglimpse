"use client";

/** 単一行の型（stringキーに対してunknown値） */
export type Row = Record<string, unknown>;

/** UTF-8 BOM + CRLF（Excel互換）でCSVをダウンロード */
export function exportCsv(filename: string, rows: Row[], cols: string[]) {
  if (!rows.length) return;

  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [
    cols.map(esc).join(","), // ヘッダー
    ...rows.map(r => cols.map(c => esc(r[c])).join(",")), // 各行
  ];

  const bom = "\uFEFF";
  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
