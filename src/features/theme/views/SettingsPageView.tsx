"use client";

import * as React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { type ThemePresetKey } from "@/features/theme/domain/presets";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import BarGradients from "@/features/dashboard/components/BarGradients";
import HighlightColors from "@/features/dashboard/components/HighlightColors";

export type Mode = "light" | "dark" | "system";
// CHART_PALETTES のキー型（presets で定義済みの色セット名と一致させる）
export type ChartKey =
  | "blue" | "green" | "yellow" | "red" | "purple" | "pink" | "gray";

type Props = {
  mode: Mode;
  preset: ThemePresetKey;
  currentChart: ChartKey;
  onChangeMode: (e: React.ChangeEvent<HTMLInputElement>, value: string) => void;
  onChangePreset: (e: React.MouseEvent<HTMLElement>, value: ThemePresetKey | null) => void;
  onChangeChart: (e: React.MouseEvent<HTMLElement>, value: ChartKey | null) => void;
};

export default function SettingsPageView({
  mode,
  preset,
  currentChart,
  onChangeMode,
  onChangePreset,
  onChangeChart,
}: Props): React.JSX.Element {
  // ── プレビュー用のダミーデータ ──
  type PreviewDatum = { name: string; value: number };
  const previewData: PreviewDatum[] = [
    { name: "A", value: 20 },
    { name: "B", value: 18 },
    { name: "C", value: 16 },
    { name: "D", value: 14 },
    { name: "E", value: 12 },
    { name: "F", value: 10 },
    { name: "G", value: 8 },
    { name: "H", value: 6 },
  ];
  const gradientIds = ["dgBlue1", "dgBlue2", "dgBlue3", "dgBlue4"] as const;

  const PREVIEW_BAR_SIZE = 50;

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        設定
      </Typography>

      <Paper variant="outlined">
        <Stack p={2} gap={2}>
          <Typography variant="subtitle1">テーマモード</Typography>
          <RadioGroup row value={mode} onChange={onChangeMode}>
            <FormControlLabel value="light" control={<Radio />} label="ライト" />
            <FormControlLabel value="dark" control={<Radio />} label="ダーク" />
            <FormControlLabel value="system" control={<Radio />} label="自動（OS）" />
          </RadioGroup>

          <Divider />

          <Typography variant="subtitle1">テーマ・プリセット</Typography>
          <ToggleButtonGroup exclusive value={preset} onChange={onChangePreset}>
            <ToggleButton value="minimal">Minimal</ToggleButton>
            <ToggleButton value="classic">Classic</ToggleButton>
            <ToggleButton value="dense">Dense</ToggleButton>
          </ToggleButtonGroup>

          <Divider />

          <Typography variant="subtitle1">グラフ配色</Typography>
          <ToggleButtonGroup exclusive value={currentChart} onChange={onChangeChart}>
            <ToggleButton value="blue">Blue</ToggleButton>
            <ToggleButton value="green">Green</ToggleButton>
            <ToggleButton value="yellow">Yellow</ToggleButton>
            <ToggleButton value="red">Red</ToggleButton>
            <ToggleButton value="purple">Purple</ToggleButton>
            <ToggleButton value="pink">Pink</ToggleButton>
            <ToggleButton value="gray">Gray</ToggleButton>
          </ToggleButtonGroup>

          {/* ───────────── プレビュー（テーマと連動） ───────────── */}
          <Box>
            <Typography variant="caption" color="text.secondary">
              プレビュー
            </Typography>
            <Box sx={{ height: 160, mt: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={previewData}
                  barCategoryGap={24}
                  barGap={8}
                >
                  <BarGradients />
                  <HighlightColors />

                  <CartesianGrid stroke="url(#dgGrid)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />

                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={PREVIEW_BAR_SIZE}>
                    {previewData.map((_, i) => (
                      <Cell key={i} fill={`url(#${gradientIds[i % gradientIds.length]})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
