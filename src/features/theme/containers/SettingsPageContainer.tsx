"use client";

import * as React from "react";
import { SettingsContext } from "@/app/providers";
import { PRESETS, type ThemePresetKey } from "@/features/theme/domain/presets";
import SettingsPageView, {
  type Mode,
  type ChartKey,
} from "@/features/theme/views/SettingsPageView";

/**
 * 型ガード関数: 渡された文字列が Mode 型（"light" | "dark" | "system"）のいずれかかを判定する。
 * - RadioGroup や ToggleButtonGroup の onChange ハンドラは string を返すため、型安全に絞り込みする必要がある。
 * - true の場合、value は Mode 型として扱える。
 */
function isMode(v: string): v is Mode {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * SettingsPageContainer
 * =============================================================================
 * アプリのテーマ関連設定を制御するコンテナコンポーネント。
 * 
 * 【責務】
 * - Context（SettingsContext）から現在の設定状態（settings）と更新関数（update）を取得。
 * - 子ビュー（SettingsPageView）に渡す「状態」と「イベントハンドラ」を定義。
 * - ドメインロジック（どの値を選んだときにどう更新するか）はここで集中管理する。
 * - 実際の UI レイアウトや表示は SettingsPageView に委譲。
 * 
 * 【主な処理】
 * - モード変更（ライト / ダーク / システム） → update({ mode })
 * - プリセット変更（"minimal" | "classic" | "dense" 等） → update({ preset })
 * - チャートテーマ変更（パレットや配色キー） → update({ chart })
 */
export default function SettingsPageContainer(): React.JSX.Element {
  const { settings, update } = React.useContext(SettingsContext);

  /** モード切替イベントハンドラ */
  const handleModeChange = (_: React.ChangeEvent<HTMLInputElement>, value: string) => {
    if (isMode(value)) update({ mode: value });
  };

  /** テーマプリセット切替イベントハンドラ */
  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, value: ThemePresetKey | null) => {
    if (value) update({ preset: value });
  };

  /** チャート配色切替イベントハンドラ */
  const handleChartChange = (_: React.MouseEvent<HTMLElement>, value: ChartKey | null) => {
    if (value) update({ chart: value });
  };

  /**
   * UI表示用に「現在のチャートキー」を算出
   * - settings.chart が明示的に指定されていればそれを使用
   * - 未指定の場合は選択中プリセットに定義されたデフォルト chart を使用
   * - TypeScript 型の安全性確保のためキャストを明示
   */
  const currentChart: ChartKey = (settings.chart ?? PRESETS[settings.preset].chart) as ChartKey;

  return (
    <SettingsPageView
      mode={settings.mode}
      preset={settings.preset}
      currentChart={currentChart}
      onChangeMode={handleModeChange}
      onChangePreset={handlePresetChange}
      onChangeChart={handleChartChange}
    />
  );
}
