"use client";

import * as React from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import {
  PRESETS,
  CHART_PALETTES,
  type ThemePresetKey,
} from "@/features/theme/domain/presets";

/* ---- Theme 拡張 ---- */
declare module "@mui/material/styles" {
  interface Theme {
    custom: { chartPalette: readonly string[] };
  }
  interface ThemeOptions {
    custom?: { chartPalette?: readonly string[] };
  }
}

/* ---- 設定型 ---- */
type Mode = "light" | "dark" | "system";
type ChartKey = keyof typeof CHART_PALETTES;

type Settings = {
  mode: Mode;
  preset: ThemePresetKey;
  chart?: ChartKey;
};

const DEFAULT_SETTINGS: Settings = { mode: "system", preset: "minimal" } as const;
const STORAGE_KEY = "dg.settings.v1";

/* ---- ユーティリティ ---- */
function resolveModeWithWindow(mode: Mode): Exclude<Mode, "system"> {
  if (mode !== "system") return mode;
  // ここは「ハイドレーション完了後」にだけ使う
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/* ---- 設定管理 ---- */
function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  // SSR/初回ハイドレーションは必ず DEFAULT_SETTINGS で固定
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);

  // マウント後に localStorage を反映
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings({
          mode: parsed.mode ?? DEFAULT_SETTINGS.mode,
          preset: parsed.preset ?? DEFAULT_SETTINGS.preset,
          chart: parsed.chart,
        });
      }
    } catch {
    }
  }, []);

  // system の場合のみ OS テーマ変更を監視（マウント後）
  React.useEffect(() => {
    if (settings.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setSettings((prev) => ({ ...prev })); // 再評価トリガ
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, [settings.mode]);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next: Settings = {
        mode: patch.mode ?? prev.mode,
        preset: patch.preset ?? prev.preset,
        chart: patch.chart ?? prev.chart,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {  }
      return next;
    });
  };

  return [settings, update];
}

/* ---- Theme 構築 ---- */
function buildTheme(settings: Settings, hydrated: boolean) {
  // ハイドレーション前は必ず "light" 固定（window に触れない）
  const mode: Exclude<Mode, "system"> =
    hydrated ? resolveModeWithWindow(settings.mode) : "light";

  const preset = PRESETS[settings.preset];
  const chartKey: ChartKey = settings.chart ?? preset.chart;
  const chartPalette = CHART_PALETTES[chartKey];

  const baseFontPx = 14;
  const fontSizePx = Math.round(baseFontPx * preset.fontSize);

  return createTheme({
    palette: { mode },
    shape: { borderRadius: preset.radius },
    typography: { fontSize: fontSizePx },
    components:
      preset.density === "compact"
        ? {
            MuiListItem: { styleOverrides: { root: { paddingTop: 4, paddingBottom: 4 } } },
            MuiButton: { styleOverrides: { root: { padding: "4px 10px", minHeight: 30 } } },
            MuiTableCell: { styleOverrides: { root: { paddingTop: 6, paddingBottom: 6 } } },
          }
        : {},
    custom: { chartPalette },
  });
}

/* ---- Context ---- */
export const SettingsContext = React.createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
});

/* ---- Provider本体 ---- */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [settings, update] = useSettings();

  // ハイドレーション完了フラグ
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const theme = React.useMemo(() => buildTheme(settings, hydrated), [settings, hydrated]);

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}
