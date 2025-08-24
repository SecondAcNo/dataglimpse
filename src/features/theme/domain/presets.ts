export type ThemePresetKey = "minimal" | "classic" | "dense";

/** チャート用のカラーパレット（5色想定） */
export const CHART_PALETTES = {
  blue:   ["#90caf9", "#64b5f6", "#42a5f5", "#1e88e5", "#1565c0"],
  green:  ["#a5d6a7", "#81c784", "#66bb6a", "#43a047", "#2e7d32"],
  yellow: ["#fff59d", "#fff176", "#ffee58", "#fdd835", "#f9a825"],
  red:    ["#ef9a9a", "#e57373", "#ef5350", "#e53935", "#c62828"],
  purple: ["#ce93d8", "#ba68c8", "#ab47bc", "#8e24aa", "#6a1b9a"],
  pink:   ["#f48fb1", "#f06292", "#ec407a", "#d81b60", "#ad1457"],
  gray:   ["#e0e0e0", "#bdbdbd", "#9e9e9e", "#757575", "#616161"],
} as const;

export type ChartKey = keyof typeof CHART_PALETTES;

/** テーマ・プリセット（配色は上書き可能。既定のみ指定） */
export const PRESETS: Record<
  ThemePresetKey,
  {
    fontSize: number;                // 1.0 = 標準
    density: "compact" | "cozy";     // 表やリストの詰め具合
    chart: ChartKey;                 // 既定のチャート配色
    radius: number;                  // 角丸
  }
> = {
  minimal: { fontSize: 1.0,  density: "cozy",    chart: "blue",   radius: 12 },
  classic: { fontSize: 1.05, density: "cozy",    chart: "green",  radius: 10 },
  dense:   { fontSize: 0.95, density: "compact", chart: "gray",   radius: 8  },
};
