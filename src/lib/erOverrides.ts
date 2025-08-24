// 手動オーバーライド型（必要最小限）
export type ColumnOverride = {
  isPk?: boolean;
  isUnique?: boolean;
};

export type Overrides = {
  // テーブル名 → カラム名 → 上書き
  [table: string]: { [column: string]: ColumnOverride };
};

const KEY = "dataglimpse.er.overrides.v1";

export function loadOverrides(project = "default"): Overrides {
  try {
    const raw = localStorage.getItem(`${KEY}:${project}`);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch { return {}; }
}

export function saveOverrides(ov: Overrides, project = "default") {
  try {
    localStorage.setItem(`${KEY}:${project}`, JSON.stringify(ov));
  } catch {/* ignore */}
}

// ヘルパ：特定セルの更新
export function setColumnOverride(
  ov: Overrides,
  table: string,
  column: string,
  patch: ColumnOverride
): Overrides {
  const t = ov[table] ?? {};
  const c = t[column] ?? {};
  const merged: ColumnOverride = { ...c, ...patch };
  const next: Overrides = { ...ov, [table]: { ...t, [column]: merged } };
  return next;
}

export function clearTableOverrides(ov: Overrides, table: string): Overrides {
  if (!ov[table]) return ov;
  const next = { ...ov };
  delete next[table];
  return next;
}
