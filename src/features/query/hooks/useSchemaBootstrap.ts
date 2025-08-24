"use client";

import * as React from "react";
import { fetchSchema } from "@/features/query/services/schema";
import type { SchemaEntry } from "@/features/query/views/QueryPageView";

/** スキーマ（テーブル有無＋カラム一覧）を初期ロード＆再取得するためのフック */
export function useSchemaBootstrap() {
  const [hasTables, setHasTables] = React.useState<boolean>(false);
  const [schema, setSchema] = React.useState<SchemaEntry[]>([]);

  const refreshSchema = React.useCallback(async () => {
    const { hasTables, schema } = await fetchSchema();
    setHasTables(hasTables);
    setSchema(schema);
  }, []);

  // 初回ロード
  React.useEffect(() => {
    void refreshSchema();
  }, [refreshSchema]);

  return { hasTables, schema, refreshSchema };
}
