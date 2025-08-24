// 列の推定型（変更なし）
export type InferredType = "int" | "decimal" | "date" | "string";

export type InferredColumn = {
  name: string;
  type: InferredType;
  nullRate: number;
  unique: boolean;
};

/* =========================
   日付判定の強化ポイント
   =========================
   - 極力“形式マッチのみ”で判定して、曖昧さを減らす
   - US/欧式で曖昧になりやすい MDY/DMY は、/ と - の区切りでのみ許可
   - 4桁年が先頭に来る形式を最優先（業務データではこれが主流）
   - 時刻は省略可（hh:mm または hh:mm:ss）
*/

// 4桁年で始まるパターン（YYYY-… / YYYY/… / YYYY.… / YYYYMMDD）
const YEAR_FIRST_VARIANTS: RegExp[] = [
  // 2024-01-02（+ 時刻）
  /^\d{4}-\d{1,2}-\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  // 2024/01/02（+ 時刻）
  /^\d{4}\/\d{1,2}\/\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  // 2024.01.02（+ 時刻）
  /^\d{4}\.\d{1,2}\.\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  // 20240102（8桁連結）
  /^\d{4}\d{2}\d{2}$/
];

// 月日が先で曖昧なMDY（US）: 01/31/2024（+ 時刻）
// → スラッシュ/ハイフンのみ許可（テキストは不可）
const MDY_VARIANTS: RegExp[] = [
  /^(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-]\d{4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/
];

// 日月が先のDMY（EU/JP書類系）: 31/01/2024（+ 時刻）
const DMY_VARIANTS: RegExp[] = [
  /^(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-]\d{4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/
];

// ISO拡張（Zやタイムゾーン付き 例: 2024-01-02T12:34:56Z, 2024-01-02T12:34:56+09:00）
const ISO_VARIANTS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})$/
];

// 判定器：どれか1つにマッチすれば日付扱い
function isDateLike(s: string): boolean {
  const v = s.trim();
  if (v.length === 0) return false;

  // まずは年先頭やISOなど“強い根拠”を見る
  for (const r of [...YEAR_FIRST_VARIANTS, ...ISO_VARIANTS]) {
    if (r.test(v)) return true;
  }
  // 次に地域差で曖昧なもの（MDY / DMY）
  for (const r of [...MDY_VARIANTS, ...DMY_VARIANTS]) {
    if (r.test(v)) return true;
  }

  // ここまでで落ちた場合は日付ではないとみなす（曖昧排除）
  return false;
}

// 数値判定たち（前回と同等）
function isInt(x: string) { return /^-?\d+$/.test(x); }
function isDecimal(x: string) { return /^-?\d+(\.\d+)?$/.test(x); }

export function inferColumns(
  rows: Array<Record<string, unknown>>,
  headers: string[]
): InferredColumn[] {
  return headers.map((h) => {
    const values = rows.map((r) => r[h]).filter((v) => v !== undefined);

    let nullCount = 0;
    let ints = 0;
    let decimals = 0;
    let dates = 0;

    const seen = new Set<string>();
    let hasNull = false;

    for (const v of values) {
      if (v === null || v === "") { nullCount++; hasNull = true; continue; }
      const s = String(v).trim();
      if (s.length === 0) { nullCount++; hasNull = true; continue; }

      seen.add(s);

      if (isInt(s)) ints++;
      else if (isDecimal(s)) decimals++;
      else if (isDateLike(s)) dates++;
    }

    const nonNull = values.length - nullCount;
    let type: InferredType = "string";

    if (nonNull > 0) {
      if (ints === nonNull) type = "int";
      else if (ints + decimals === nonNull) type = "decimal";
      else if (dates === nonNull) type = "date";
      else type = "string";
    }

    const nullRate = nullCount / (values.length || 1);
    const unique = !hasNull && seen.size === nonNull && nonNull > 0;

    return { name: h, type, nullRate, unique };
  });
}
