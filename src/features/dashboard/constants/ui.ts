/**
 *   ui.ts - カード高さとフェードイン共通設定
 * 
 * - ChartCard の高さを vh で安定確保（Recharts は親の明示的高さが必要）
 * - 一覧カードのフェードインを一度だけ/遅延つきで統一
 */

/** ChartCardの高さ（レスポンシブ） */
export const CARD_HEIGHT_PCT = { xs: "22vh", md: "22vh", lg: "22vh" } as const;

/** framer-motion 用のフェードイン設定 */
export const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
} as const;

// フェードのベース遅延（カード i 番目 => base * i）
export const FADEIN_DELAY_BASE = 0.05;
