"use client";

import * as React from "react";
import { formatSql } from "@/features/query/services/format";

/** SQL整形の状態とハンドラを提供するフック */
export function useSqlFormatting(sql: string, setSql: (s: string) => void) {
  const [formatting, setFormatting] = React.useState(false);

  const handleFormat = React.useCallback(() => {
    setFormatting(true);
    const out = formatSql(sql);
    if (out && out !== sql) setSql(out);
    setFormatting(false);
  }, [sql, setSql]);

  return { formatting, handleFormat };
}
