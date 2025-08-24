/**
 * charts.ts - Recharts/MUI 向け共通定数
 * 目的: デザインと見やすさの一貫性を担保（値はUI/密度/可読性から決定）
 * 注意: 参照側の補完/型安全のため一部 as const を使用
 */

//棒・角丸
export const BAR_SIZE = 18;
export const BAR_RADIUS = 6;

//TopN（カードの表示件数ポリシー）
export const TOP_ROWS_N = 7;
export const COMPLETENESS_WORST_N = 7;
export const OUTBOUND_TOP_N = 7;
export const SIZE_TOP_N = 5;

//しきい値/目安ライン
export const FK_COVERAGE_GOOD_THRESHOLD = 80; // %

export const CORR_TICK_COUNT = 5;

//グリッド/軸ラベル幅（視認性ポリシー）
export const GRID_DASH = "3 3";
export const YAXIS_LABEL_WIDTH = {
  rowsTop: 90,
  outboundTop: 110,
} as const;

//ラジアル（サイズ感ドーナツ）
export const RADIAL = {
  cx: "50%",
  cy: "50%",
  inner: "24%",
  outer: "99%",
  start: 90,
  end: -270,
  margin: { top: 0, right: 0, bottom: 0, left: 0 } as const,
};

//ブランド青スケール
export const BLUE_SCALE = ["#90caf9", "#64b5f6", "#42a5f5", "#1e88e5", "#1565c0"];
