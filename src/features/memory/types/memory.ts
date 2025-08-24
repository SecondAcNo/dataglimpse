/** 実行状態（UI内部型） */
export type ExecState = {
  status: string;
  execMs: number | null;
};

/** 画面モード */
export type Mode = "query" | "adhoc";

/** Parquet エクスポート元 */
export type ExportSource = "table" | "sql";

/** Parquet 圧縮方式 */
export type ParquetCodec = "zstd" | "snappy" | "uncompressed";

/** DuckDB/Emscripten VFS 型 */
export type DuckVFS = {
  stat: (path: string) => { size: number };
  open: (path: string, mode: string) => number;
  read: (fd: number, buf: Uint8Array, offset: number, length: number, position: number) => number;
  close: (fd: number) => void;
  unlink?: (path: string) => void;
};
