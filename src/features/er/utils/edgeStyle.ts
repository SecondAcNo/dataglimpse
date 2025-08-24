import { MarkerType, type DefaultEdgeOptions } from "reactflow";
import type { EdgeStyleConfig } from "../domain/type";

/**
 * defaultEdgeStyle
 * -----------------------------------------------------------------------------
 * エッジ（リレーション線）の標準スタイル定義。
 *
 * - type: "smoothstep" ... ノードを避けつつ滑らかな曲線で描画されるスタイル。
 * - color: "#69f" ... デフォルトの線色（ライトブルー寄り）
 * - dashed: true ... デフォルトは破線を採用し、実線と区別可能にする
 * - width: 2px ... 視認性を確保するための線幅
 * - arrowStart: false ... デフォルトでは始点に矢印なし
 * - arrowEnd: true ... デフォルトでは終点に矢印あり（典型的なリレーション方向を表現）
 *
 */
export const defaultEdgeStyle: EdgeStyleConfig = {
  type: "smoothstep",
  color: "#69f",
  dashed: true,
  width: 2,
  arrowStart: false,
  arrowEnd: true,
};

/**
 * buildEdgeStyle
 * -----------------------------------------------------------------------------
 * EdgeStyleConfig から ReactFlow 用の DefaultEdgeOptions を生成する。
 *
 * 引数:
 * - cfg: EdgeStyleConfig (UI 設定 or デフォルト)
 *
 * 戻り値:
 * - DefaultEdgeOptions (ReactFlow のエッジ描画オプション)
 *
 * 注意点:
 * - ReactFlow のエッジ描画は SVG ベースなので、strokeDasharray の値は SVG 仕様に準拠。
 * - 矢印サイズ (width/height=18) は視認性を優先しつつ控えめに設定。
 */
export function buildEdgeStyle(cfg: EdgeStyleConfig): DefaultEdgeOptions {
  const style: React.CSSProperties = {
    stroke: cfg.color,
    strokeWidth: cfg.width,
    ...(cfg.dashed ? { strokeDasharray: "6 4" } : null),
  };
  const arrow = { type: MarkerType.ArrowClosed as const, width: 18, height: 18, color: cfg.color };
  return {
    style,
    markerStart: cfg.arrowStart ? arrow : undefined,
    markerEnd: cfg.arrowEnd ? arrow : undefined,
    type: cfg.type,
  };
}
