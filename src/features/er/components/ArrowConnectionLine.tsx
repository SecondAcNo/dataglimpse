"use client";

import * as React from "react";
import { getSmoothStepPath, type ConnectionLineComponentProps } from "reactflow";
import type { JSX } from "react";

/**
 * ArrowLineCfg
 * -----------------------------------------------------------------------------
 * ConnectionLine（接続線）の見た目を柔軟にカスタマイズするための設定オブジェクト。
 * - color    : 線や矢印の色を指定（CSSカラー値）
 * - width    : 線幅(px)
 * - dashed   : true の場合、破線スタイルを適用
 * - arrowEnd : true の場合、終端に矢印を描画
 * 
 * 用途: React Flow が提供するデフォルトの接続線では表現力が不足する場合に利用。
 */
export type ArrowLineCfg = {
  color?: string;
  width?: number;
  dashed?: boolean;
  arrowEnd?: boolean;
};

/**
 * ArrowConnectionLine
 * -----------------------------------------------------------------------------
 * React Flow の「ドラッグ中に表示される接続線」を独自描画するコンポーネント。
 * getSmoothStepPath() を利用し、始点から終点までの平滑なステップ曲線を生成する。
 * 
 * 特徴:
 * - デフォルトでは青系 (#69f)、太さ2px、破線、矢印付きのスタイル
 * - cfg で個別カスタマイズ可能（チーム開発時の一貫した拡張ポイント）
 * - marker/defs を利用した SVG ネイティブの矢印描画（パフォーマンス/互換性良好）
 * 
 * 注意点:
 * - marker の id は一意である必要がある。現在は固定文字列だが、
 *   複数同時にレンダリングするケースでは衝突リスクがあるため、
 *   本番用途では UUID や props 由来のユニーク ID を付与するのが望ましい。
 */
type Props = ConnectionLineComponentProps & { cfg?: ArrowLineCfg };

export function ArrowConnectionLine({
  fromX, fromY, toX, toY, cfg,
}: Props): JSX.Element {
  // React Flow が提供するユーティリティで「平滑なステップ曲線」のパスを生成
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  // --- デフォルト値の定義 ---
  const color = cfg?.color ?? "#69f";      // デフォルト: 青系
  const width = cfg?.width ?? 2;           // デフォルト: 2px
  const dashed = cfg?.dashed ?? true;      // デフォルト: 破線ON
  const showArrow = cfg?.arrowEnd ?? true; // デフォルト: 矢印ON

  // NOTE: marker ID 衝突防止のためにユニーク化推奨（暫定的に固定値）
  const idEnd = "dg-conn-arrow-end";

  return (
    <g>
      <defs>
        {showArrow && (
          <marker
            id={idEnd}
            markerWidth="18"
            markerHeight="18"
            refX="10"    // 矢印の先端を線の終端に合わせるオフセット
            refY="5"
            orient="auto"
          >
            {/* 矢印の形状（三角形） */}
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        )}
      </defs>

      {/* 実際の接続線 */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? "6 4" : undefined} // "線分 長さ / 隙間 長さ"
        markerEnd={showArrow ? `url(#${idEnd})` : undefined}
      />
    </g>
  );
}
