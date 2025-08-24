"use client";

import { useCallback, useEffect, useState } from "react";
import {
  initDuckDB,
  closeDuckDB,
  listTables,
  tableInfo,
} from "@/lib/duck";
import type { ExecState } from "@/features/memory/types/memory";
import type { SchemaDict } from "@/features/memory/components/SqlBoxDuck";

/**
 * DuckDB の初期化・終了、テーブル一覧取得、スキーマ辞書更新をまとめたフック
 */
export default function useDuckInit(
  setExec: React.Dispatch<React.SetStateAction<ExecState>>
) {
  const [ready, setReady] = useState(false);

  // テーブル一覧 & 現在選択
  const [tables, setTables] = useState<string[]>([]);
  const [currentTable, setCurrentTable] = useState<string>("");

  // 補完用スキーマ辞書 { table: [col, ...] }
  const [schemaDict, setSchemaDict] = useState<SchemaDict>({});

  /** DuckDB 初期化 */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initDuckDB();
        if (!mounted) return;
        setReady(true);
        setExec({
          status: "準備完了：CSV/Parquet をアップロードしてください",
          execMs: null,
        });
        // 初回テーブル一覧
        const ts = await listTables();
        setTables(ts);
        if (ts.length > 0) setCurrentTable(ts[0]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setExec({ status: `DuckDB 初期化エラー：${msg}`, execMs: null });
      }
    })();
    return () => {
      mounted = false;
      void closeDuckDB();
    };
  }, [setExec]);

  /** テーブル一覧 → スキーマ辞書更新 */
  useEffect(() => {
    (async () => {
      if (!ready) return;
      const dict: SchemaDict = {};
      for (const t of tables) {
        const info = await tableInfo(t); // rows: name, type, ...
        dict[t] = info.rows.map((r) => String(r["name"]));
      }
      setSchemaDict(dict);
    })();
  }, [ready, tables]);

  /**
   * テーブル一覧を再読込し、必要に応じて選択テーブルを更新
   * @param preferTable 取得後に優先的に選択したいテーブル名
   */
  const reloadTables = useCallback(async (preferTable?: string) => {
    const ts = await listTables();
    setTables(ts);
    if (preferTable && ts.includes(preferTable)) {
      setCurrentTable(preferTable);
    } else if (!ts.includes(currentTable)) {
      setCurrentTable(ts[0] ?? "");
    }
    return ts;
  }, [currentTable]);

  const hasTable = ready && tables.length > 0 && currentTable !== "";

  return {
    ready,
    tables,
    currentTable,
    schemaDict,
    hasTable,
    setCurrentTable,
    reloadTables,
  };
}
