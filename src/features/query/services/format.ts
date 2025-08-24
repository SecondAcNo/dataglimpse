"use client";

import { format } from "sql-formatter";

/** 失敗しても元文字列を返す安全なフォーマッタ */
export function formatSql(input: string): string {
  try {
    return format(input, { language: "sql", keywordCase: "upper" });
  } catch {
    return input;
  }
}
