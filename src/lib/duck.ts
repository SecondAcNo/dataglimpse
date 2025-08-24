// =============================================================================
// DuckDB-WASM をブラウザで使うためのヘルパ群（GitHub Pages 対応）
// - WASM/Worker は /public 配下に同梱し、NEXT_PUBLIC_BASE_PATH を付けて配信
// - Worker は「classic」で起動（mvp.worker.js は ESM ではないため module 指定はNG）
// - Parquet は既定で SNAPPY 圧縮（ZSTD は環境によって不安定な場合がある）
// - runQuery は「結果セットを返す SQL」専用（COPY などは conn.query を直接使用）
// - MEMFS には /tmp が無い環境が多いので、出力先はルート直下 '/name.parquet' を推奨
// - GitHub Pages のキャッシュ対策としてクエリ文字列でバージョンを付与
// =============================================================================

/** セルの型（any禁止） */
export type CellValue = string | number | boolean | null;
/** 1行のレコード型（列名→値のマップ） */
export type RowData = Record<string, CellValue>;

let _duckdb: typeof import("@duckdb/duckdb-wasm") | null = null;
let _db: import("@duckdb/duckdb-wasm").AsyncDuckDB | null = null;
let _conn: import("@duckdb/duckdb-wasm").AsyncDuckDBConnection | null = null;

// GitHub Pages のベースパス（例: "/dataglimpse"）。ローカルでは空文字。
// NOTE: Next.js がビルド時に文字列へ置換するため、typeof process ガードは不要。
const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Assets cache-busting（両ファイルに同じクエリを付与してズレを防ぐ）
const DUCKDB_ASSET_VER = "v1";

// public 配下に同梱した WASM / worker を参照（ベースパス対応）
const DUCKDB_MAIN_MODULE_URL = `${BASE_PATH}/duckdb/duckdb-mvp.wasm?${DUCKDB_ASSET_VER}`;
const DUCKDB_WORKER_URL = `${BASE_PATH}/duckdb/duckdb-browser-mvp.worker.js?${DUCKDB_ASSET_VER}`;

/** DuckDB を（シングルトンで）初期化して接続を返す */
export async function initDuckDB(): Promise<{
  db: import("@duckdb/duckdb-wasm").AsyncDuckDB;
  conn: import("@duckdb/duckdb-wasm").AsyncDuckDBConnection;
}> {
  if (_db && _conn) return { db: _db, conn: _conn };

  if (typeof window === "undefined") {
    throw new Error("duckdb-wasm is client-only. Call initDuckDB() in the browser.");
  }

  if (_duckdb === null) {
    _duckdb = await import("@duckdb/duckdb-wasm");
  }

  // --- Worker は classic で起動（module 指定は NG）---
  const worker = new Worker(DUCKDB_WORKER_URL);
  worker.addEventListener("error", (e) => {
    console.error("duckdb worker error:", e);
  });

  const logger = new _duckdb.ConsoleLogger();
  const db = new _duckdb.AsyncDuckDB(logger, worker);

  // ベースパス付きの wasm URL を指定して起動
  await db.instantiate(DUCKDB_MAIN_MODULE_URL);

  const conn = await db.connect();
  _db = db;
  _conn = conn;
  return { db, conn };
}

/** クリーンアップ（明示的に閉じる用） */
export async function closeDuckDB(): Promise<void> {
  if (_conn) {
    await _conn.close();
    _conn = null;
  }
  if (_db) {
    await _db.terminate();
    _db = null;
    // VFSキャッシュも一緒にクリア
    __vfsCache.clear();
    __fdTable.clear();
    __nextFd = 3;
  }
}

/** 仮想FSにファイルを登録（絶対パス必須） */
export async function registerFile(path: `/${string}`, data: Uint8Array): Promise<void> {
  if (_db === null) throw new Error("DuckDB not initialized");
  await _db.registerFileBuffer(path, data);
}

/** CSV をテーブル化（read_csv_auto を使用） */
export async function createTableFromCSV(tableName: string, path: `/${string}`): Promise<void> {
  if (_conn === null) throw new Error("DuckDB connection not initialized");
  const safe = escapeIdent(tableName);
  await _conn.query(
    `CREATE OR REPLACE TABLE ${safe} AS SELECT * FROM read_csv_auto('${path}', HEADER=TRUE)`
  );
}

/** Parquet をテーブル化（read_parquet を使用） */
export async function createTableFromParquet(tableName: string, path: `/${string}`): Promise<void> {
  if (_conn === null) throw new Error("DuckDB connection not initialized");
  const safe = escapeIdent(tableName);
  await _conn.query(
    `CREATE OR REPLACE TABLE ${safe} AS SELECT * FROM read_parquet('${path}')`
  );
}

/** 任意SQLを実行して列名と行配列を返す（SELECT 等の結果セット専用） */
export async function runQuery(sql: string): Promise<{ columns: string[]; rows: RowData[] }> {
  if (_conn === null) throw new Error("DuckDB connection not initialized");
  const res = await _conn.query(sql);

  const fields = res.schema.fields;
  const columns: string[] = new Array(fields.length);
  for (let i = 0; i < fields.length; i++) {
    columns[i] = fields[i].name;
  }

  const raw = res.toArray();
  const out: RowData[] = new Array(raw.length);
  for (let r = 0; r < raw.length; r++) {
    const rowObj: RowData = {};
    const row = raw[r];
    for (let c = 0; c < columns.length; c++) {
      const name = columns[c];
      rowObj[name] = row[name] as CellValue;
    }
    out[r] = rowObj;
  }
  return { columns, rows: out };
}

/** テーブル一覧（main スキーマ） */
export async function listTables(): Promise<string[]> {
  const q = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main'
    ORDER BY table_name
  `;
  const { rows } = await runQuery(q);
  const names: string[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    names[i] = String(rows[i]["table_name"]);
  }
  return names;
}

/** カラム情報（PRAGMA） */
export async function tableInfo(tableName: string): Promise<{ columns: string[]; rows: RowData[] }> {
  const safe = escapeIdent(tableName);
  return runQuery(`PRAGMA table_info(${safe})`);
}

/** プレビュー（上位N行） */
export async function previewTable(tableName: string, limit = 100): Promise<{ columns: string[]; rows: RowData[] }> {
  const n = limit > 0 ? Math.floor(limit) : 0;
  const safe = escapeIdent(tableName);
  return runQuery(`SELECT * FROM ${safe} LIMIT ${n}`);
}

/* ========= Parquet 変換/保存 ========= */

export type ParquetCompression = "zstd" | "snappy" | "uncompressed";

/** SELECT を MEMFS の outPath に Parquet で書き出す
 *  NOTE:
 *   - 出力先はルート直下 '/name.parquet' 推奨（/tmp は存在しないことが多い）
 *   - 既存ファイルは事前に削除してクリーンに
 *   - 既定は SNAPPY（安定性重視）。必要に応じて "uncompressed" や "zstd" を指定。
 */
export async function copyToParquetMemfs(
  selectSql: string,
  outPath: `/${string}`,
  compression: ParquetCompression = "snappy"
): Promise<void> {
  if (_conn === null) throw new Error("DuckDB connection not initialized");

  // 既存ファイルがあれば削除（存在しなくても無視）
  await unlink(outPath).catch(() => { /* noop */ });

  const sql = `
    COPY (${selectSql})
    TO '${outPath}'
    (FORMAT 'parquet', COMPRESSION '${compression.toUpperCase()}');
  `;
  await _conn.query(sql);
}

/** 変換直後の Parquet を read_parquet で検証（例：行数を返す） */
export async function verifyParquetCount(path: `/${string}`): Promise<number> {
  const { rows } = await runQuery(`SELECT COUNT(*)::INT AS n FROM read_parquet('${path}')`);
  return Number(rows[0]?.n ?? 0);
}

/* ========= MEMFS I/O ========= */

/** MEMFS のファイル全体を ArrayBuffer で取得（duckdb-wasm のビルド差を吸収） */
export async function readMemFile(path: `/${string}`): Promise<ArrayBuffer> {
  if (_db === null) throw new Error("DuckDB not initialized");
  const anyDb = _db as unknown as {
    copyFileToArrayBuffer?: (p: string) => Promise<ArrayBuffer>;
    copyFileToBuffer?: (p: string) => Promise<Uint8Array>;
  };
  if (typeof anyDb.copyFileToArrayBuffer === "function") {
    return await anyDb.copyFileToArrayBuffer(path);
  }
  if (typeof anyDb.copyFileToBuffer === "function") {
    const u8 = await anyDb.copyFileToBuffer(path);
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    return ab;
  }
  throw new Error("readMemFile is not supported by this duckdb-wasm build");
}

/** MEMFS からファイル削除（任意） */
export async function unlink(path: `/${string}`): Promise<void> {
  if (_db === null) throw new Error("DuckDB not initialized");
  const anyDb = _db as unknown as {
    unlinkFile?: (p: string) => Promise<void>;
  };
  if (typeof anyDb.unlinkFile === "function") {
    await anyDb.unlinkFile(path);
  }
}

/* ========= VFSアダプタ（read-only） ========= */

type VfsCacheEntry = {
  data: Uint8Array;
  size: number;
};

const __vfsCache: Map<string, VfsCacheEntry> = new Map();

type FdRecord = { path: string };
const __fdTable: Map<number, FdRecord> = new Map();
let __nextFd = 3;

/** DuckDB/Emscripten風 VFS を返す（read-only）
 *  NOTE: __ensureCached を事前に呼んだ前提。未キャッシュは size=0 を返す。
 */
export function getDuckVFS(): {
  stat: (path: string) => { size: number };
  open: (path: string, mode: string) => number;
  read: (fd: number, buf: Uint8Array, offset: number, length: number, position: number) => number;
  close: (fd: number) => void;
  unlink?: (path: string) => void;
} {
  return {
    stat: (path: string) => {
      const p = path as `/${string}`;
      const ent = __vfsCache.get(p);
      return { size: ent ? ent.size : 0 };
    },
    open: (path: string, mode: string) => {
      if (mode !== "r") throw new Error("getDuckVFS.open: read-only supported");
      const p = path as `/${string}`;
      if (!__vfsCache.has(p)) {
        // 事前に __ensureCached() を呼ばないと size=0 のままになる点に注意
        __vfsCache.set(p, { data: new Uint8Array(0), size: 0 });
      }
      const fd = __nextFd++;
      __fdTable.set(fd, { path: p });
      return fd;
    },
    read: (fd: number, buf: Uint8Array, offset: number, length: number, position: number) => {
      const rec = __fdTable.get(fd);
      if (!rec) return 0;
      const p = rec.path as `/${string}`;
      const ent = __vfsCache.get(p);
      if (!ent || ent.size === 0) {
        // 本来は __ensureCached を await したいところだが同期関数なので 0 を返却
        return 0;
      }
      const end = Math.min(position + length, ent.size);
      const n = Math.max(0, end - position);
      if (n > 0) {
        buf.set(ent.data.subarray(position, position + n), offset);
      }
      return n;
    },
    close: (fd: number) => {
      __fdTable.delete(fd);
    },
    unlink: (path: string) => {
      const p = path as `/${string}`;
      __vfsCache.delete(p);
      void unlink(p);
    },
  };
}

/** 識別子エスケープ（単純版） */
function escapeIdent(ident: string): string {
  const safe = ident.replace(/"/g, '""');
  return `"${safe}"`;
}

/* ========= CSV ユーティリティ ========= */

/** SELECT を MEMFS に CSV で書き出す（ヘッダー有無を指定可能） */
export async function copyToCsvMemfs(
  selectSql: string,
  outPath: `/${string}`,
  header = true
): Promise<void> {
  if (_conn === null) throw new Error("DuckDB connection not initialized");
  await _conn.query(
    `COPY (${selectSql}) TO '${outPath}' (FORMAT CSV, HEADER ${header ? "TRUE" : "FALSE"});`
  );
}

/** MEMFS → ブラウザダウンロード
 *  NOTE: 既定MIMEは CSV。Parquet 等では呼び出し側で MIME を渡すこと。
 *        例) downloadMemfsFile(p, "file.parquet", "application/x-parquet")
 */
export async function downloadMemfsFile(
  path: `/${string}`,
  filename: string,
  mime = "text/csv;charset=utf-8",
  unlinkAfter = true // 検証で再読込したい場合は false を渡す
): Promise<void> {
  const ab = await readMemFile(path);
  const url = URL.createObjectURL(new Blob([ab], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);

  if (unlinkAfter) {
    await unlink(path).catch(() => {});
  }
}
