// Next.js向け：ブラウザ限定の動的importで sql.js を読み込み、IndexedDB に永続化。
// 依存: sql.js / @types/sql.js
//   npm i sql.js && npm i -D @types/sql.js
//   ※ GitHub Pages 対応（ベースパス付き配信）
//   cp node_modules/sql.js/dist/sql-wasm.wasm public/wasm/sql-wasm.wasm
//
//   本番（例: /dataglimpse）では NEXT_PUBLIC_BASE_PATH=/dataglimpse を設定し、
//   locateFile が `${base}/wasm/sql-wasm.wasm` を返すようにする。

import type {
  Database,
  Statement,
  SqlJsStatic,
  BindParams,
  SqlValue,
} from "sql.js";

export type RowObject = Record<string, unknown>;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dirty = false;
let persistenceAvailable = false;

const KV_DB_NAME = "dg-kv";
const KV_STORE = "kv";
const DB_KEY = "dataglimpse.sqlite";

// GitHub Pages のベースパス（例: "/dataglimpse"）。ローカル開発では空文字。
const BASE_PATH = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) || "";

// ---------------- IndexedDB（素のAPI） ----------------
function openKv(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(KV_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbx = req.result;
      if (!dbx.objectStoreNames.contains(KV_STORE)) dbx.createObjectStore(KV_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open error"));
  });
}

function kvGet(key: string): Promise<Uint8Array | null> {
  return new Promise<Uint8Array | null>(async (resolve, reject) => {
    let handle: IDBDatabase | null = null;
    try {
      handle = await openKv();
      const tx = handle.transaction(KV_STORE, "readonly");
      const store = tx.objectStore(KV_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result as unknown;
        if (val == null) resolve(null);
        else if (val instanceof Uint8Array) resolve(val);
        else if (val instanceof ArrayBuffer) resolve(new Uint8Array(val));
        else if (val instanceof Blob) val.arrayBuffer().then(b => resolve(new Uint8Array(b))).catch(reject);
        else resolve(null);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB get error"));
    } catch (e) {
      reject(e);
    } finally {
      handle?.close();
    }
  });
}

function kvSet(key: string, value: Uint8Array): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    let handle: IDBDatabase | null = null;
    try {
      handle = await openKv();
      const tx = handle.transaction(KV_STORE, "readwrite");
      const store = tx.objectStore(KV_STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("IndexedDB put error"));
    } catch (e) {
      reject(e);
    } finally {
      handle?.close();
    }
  });
}

// ---------------- sql.js ローダ（ブラウザ限定・動的import） ----------------
async function loadSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  if (typeof window === "undefined") {
    // SSR 側から誤って呼ばれた場合は明示的に拒否
    throw new Error("sql.js is client-only. Use this module in the browser.");
  }

  // 重要：ブラウザ用エントリに限定（Nodeのfs依存を回避）
  const mod = await import("sql.js/dist/sql-wasm.js");
  SQL = await mod.default({
    // wasm の配置先（/public 配下）。GitHub Pages のベースパスに対応。
    locateFile: (file: string) => `${BASE_PATH}/wasm/${file}`, // → /dataglimpse/wasm/sql-wasm.wasm
  });
  return SQL;
}

// ---------------- DB 初期化（IndexedDB -> メモリ） ----------------
let autosaveHooked = false;
function hookAutoSaveOnPageHide() {
  if (autosaveHooked || typeof window === "undefined") return;
  autosaveHooked = true;
  const flush = () => { void saveNow(); };
  // タブが非表示になった/ページ離脱時に強制保存
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const sql = await loadSqlJs();
  try {
    const bytes = await kvGet(DB_KEY);
    if (bytes && bytes.byteLength > 0) {
      db = new sql.Database(bytes);
      persistenceAvailable = true;
    } else {
      db = new sql.Database(); // 空DBで開始
      persistenceAvailable = true; // 保存先は用意できる
    }
  } catch {
    db = new sql.Database(); // IndexedDB不可 → 完全メモリ
    persistenceAvailable = false;
  }

  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA temp_store = MEMORY;");

  // 離脱時の強制保存フック
  hookAutoSaveOnPageHide();

  return db;
}

export function isPersistent(): boolean {
  return persistenceAvailable;
}

// ---------------- Core API ----------------
export async function exec(sqlText: string, params?: BindParams): Promise<void> {
  const d = await getDb();
  if (params !== undefined) d.run(sqlText, params);
  else d.run(sqlText);
  dirty = true;
  await saveSoon(); // DDL/DML 実行後は永続化をスケジュール
}

export async function query<T extends RowObject = RowObject>(
  sqlText: string,
  params?: BindParams
): Promise<T[]> {
  const d = await getDb();
  const stmt: Statement = d.prepare(sqlText);
  const rows: T[] = [];
  try {
    if (params !== undefined) stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
  } finally {
    stmt.free();
  }
  return rows;
}

// ---------------- Utils ----------------
function safeIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

// ---------------- CSV import（型推定＋PK/UNIQUE 付与） ----------------
type Affinity = "INTEGER" | "REAL" | "NUMERIC" | "TEXT";

const intRe = /^[+-]?\d+$/;
const realRe = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/;
const boolTrue = new Set(["true", "1", "yes", "y", "t"]);
const boolFalse = new Set(["false", "0", "no", "n", "f"]);
const dateRe =
  /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

function guessAffinity(values: unknown[]): {
  affinity: Affinity;
  isBool: boolean;
  isDateLike: boolean;
} {
  let nn = 0, ints = 0, nums = 0, dates = 0, bools = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    nn++;
    if (typeof v === "number") { nums++; if (Number.isInteger(v)) ints++; continue; }
    const s = String(v).trim().toLowerCase();
    if (!s) continue;
    if (boolTrue.has(s) || boolFalse.has(s)) { bools++; continue; }
    if (intRe.test(s)) { ints++; nums++; continue; }
    if (realRe.test(s)) { nums++; continue; }
    if (dateRe.test(s)) { dates++; continue; }
  }
  const out = { affinity: "TEXT" as Affinity, isBool: false, isDateLike: false };
  if (nn === 0) return out;
  if (bools / nn >= 0.95) { out.affinity = "INTEGER"; out.isBool = true; return out; }
  if (ints === nn) { out.affinity = "INTEGER"; return out; }
  if (nums === nn) { out.affinity = "REAL"; return out; }
  if (dates / nn >= 0.8) { out.affinity = "NUMERIC"; out.isDateLike = true; return out; }
  return out;
}

function coerceByAffinity(v: unknown, aff: Affinity, isBool: boolean): SqlValue {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : String(v);
  if (s === "") return null;

  if (isBool) {
    const low = s.toLowerCase();
    if (boolTrue.has(low)) return 1;
    if (boolFalse.has(low)) return 0;
    return null;
  }
  if (aff === "INTEGER" && intRe.test(s)) return Number(s);
  if (aff === "REAL" && (intRe.test(s) || realRe.test(s))) return Number(s);
  // NUMERIC（日時等）は文字列/数値混在を許容（SQLiteは柔軟）
  return s as SqlValue;
}

export async function importCsv(table: string, rows: readonly RowObject[]): Promise<void> {
  if (rows.length === 0) return;
  const d = await getDb();

  // ヘッダ確定
  const headers = Object.keys(rows[0]);
  if (headers.length === 0) return;

  // サンプルから型推定（最大 1,000 行）
  const sample = rows.slice(0, 1000);
  const inferred = headers.map((h) => {
    const vals = sample.map((r) => r[h]);
    const g = guessAffinity(vals);
    return { name: h, ...g };
  });

  // NOT NULL / UNIQUE 推定（全体）
  const notNulls = new Set<string>();
  const uniques = new Set<string>();
  for (const h of headers) {
    let empty = 0;
    const seen = new Set<string>();
    let dup = false;
    for (const r of rows) {
      const raw = r[h];
      const v = raw == null ? "" : String(raw).trim();
      if (v === "") { empty++; continue; }
      if (seen.has(v)) dup = true;
      seen.add(v);
    }
    if (empty === 0) notNulls.add(h);
    if (!dup && seen.size > 0) uniques.add(h);
  }

  // 自然キー候補（id）が一意かつ非NULLなら PK に
  let pk: string | undefined;
  if (headers.includes("id")) {
    const all = rows.map((r) => r["id"]);
    const notNull = all.every((v) => v != null && String(v).trim() !== "");
    const uniq = new Set(all.map((v) => String(v))).size === all.length;
    if (notNull && uniq) pk = "id";
  }

  // DDL 構築
  const colDefs: string[] = [];
  if (!pk) colDefs.push(`${safeIdent("id")} INTEGER PRIMARY KEY`); // サロゲート
  for (const c of inferred) {
    const parts = [`${safeIdent(c.name)} ${c.affinity}`];
    if (notNulls.has(c.name)) parts.push("NOT NULL");
    colDefs.push(parts.join(" "));
  }
  const uniqueClauses = [...uniques]
    .filter((u) => u !== pk) // PKは自動一意
    .map((u) => `UNIQUE (${safeIdent(u)})`);

  const pkClause = pk ? `, PRIMARY KEY (${safeIdent(pk)})` : "";
  const ddl =
    `CREATE TABLE IF NOT EXISTS ${safeIdent(table)} (` +
    `${colDefs.join(", ")}${pkClause}${uniqueClauses.length ? ", " + uniqueClauses.join(", ") : ""}` +
    `)`;

  // 挿入（トランザクション）
  d.run("BEGIN");
  try {
    d.run(ddl);

    const insertCols = pk ? headers : (["id", ...headers]);
    const placeholders = insertCols.map(() => "?").join(",");
    const stmt = d.prepare(
      `INSERT INTO ${safeIdent(table)} (${insertCols.map(safeIdent).join(",")}) VALUES (${placeholders})`
    );

    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const values: SqlValue[] = [];

        if (!pk) values.push(i + 1); // サロゲート id

        for (const col of inferred) {
          const raw = Object.prototype.hasOwnProperty.call(r, col.name) ? r[col.name] : null;
          values.push(coerceByAffinity(raw, col.affinity, col.isBool));
        }

        const params: BindParams = values; // SqlValue[] は BindParams の一部型
        stmt.bind(params);
        stmt.step();
        stmt.reset();
      }
    } finally {
      stmt.free();
    }

    d.run("COMMIT");
    dirty = true;
    await saveSoon(); // 自動保存
  } catch (e) {
    try { d.run("ROLLBACK"); } catch { /* noop */ }
    throw e;
  }
}

// ---------------- Persist ----------------
let saveTimer: number | null = null;

export async function saveSoon(ms = 800): Promise<void> {
  if (!persistenceAvailable || !dirty) return;
  if (saveTimer !== null && typeof window !== "undefined") window.clearTimeout(saveTimer);
  if (typeof window !== "undefined") {
    saveTimer = window.setTimeout(() => { void saveNow(); }, ms);
  }
}

export async function saveNow(): Promise<void> {
  if (!persistenceAvailable || !dirty) return;
  const d = await getDb();
  const bytes = d.export();
  await kvSet(DB_KEY, bytes);
  dirty = false;
}

// ---------------- Helpers ----------------
export async function resetAll(): Promise<void> {
  const sql = await loadSqlJs();
  db = new sql.Database();
  dirty = true;
  if (persistenceAvailable) await kvSet(DB_KEY, new Uint8Array());
}

export async function listTables(): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT name
       FROM sqlite_schema
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name;`
  );
  return rows.map((r) => r.name);
}
