"use client";

/**
 * KpiStrip
 * -----------------------------------------------------------------------------
 * KPIカードを横並びで表示するコンポーネント。
 */

import * as React from "react";
import { Paper, Stack, Typography, Skeleton, useTheme, alpha, Box } from "@mui/material";
import Grid from "@mui/material/Grid";
import CountUp from "react-countup";

export type KpiItem = { label: string; value: number; loading?: boolean };

type Props = {
  items: KpiItem[];
  loading?: boolean;
};

/** 数字がカード幅を超えそうなときだけ自動縮小して収める */
function AutoFitNumber({ value }: { value: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const max = Math.max(0, parent.clientWidth - 4);
      const w = el.scrollWidth;
      const s = w ? Math.min(1, max / w) : 1;
      setScale(Number.isFinite(s) ? Math.max(0.6, s) : 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [value]);

  return (
    <Box sx={{ transform: `scale(${scale})`, transformOrigin: "left bottom", display: "inline-block", maxWidth: "100%" }}>
      <Typography
        ref={ref}
        variant="h4"
        fontWeight={800}
        noWrap
        title={value.toLocaleString()}
        sx={{ lineHeight: 1.05, letterSpacing: "-.2px", fontVariantNumeric: "tabular-nums" }}
      >
        <CountUp end={value} duration={0.8} separator="," />
      </Typography>
    </Box>
  );
}

export default function KpiStrip({ items, loading }: Props) {
  const theme = useTheme();

  // アクセント色はテーマのチャートパレットから取得（blue/green等の選択に追従）
  const chart = theme.custom.chartPalette;
  const accentLight = chart[Math.min(1, chart.length - 1)];
  const accentMain  = chart[Math.min(3, chart.length - 1)];

  return (
    <Grid container spacing={2} columns={{ xs: 12, md: 20 }}>
      {items.map((kpi) => {
        const isLoading = kpi.loading ?? loading;

        return (
          <Grid key={kpi.label} size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                position: "relative",
                p: 2.25,
                height: 90,
                borderRadius: 3,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.03)",
                transition: "transform .15s ease, box-shadow .15s ease, border-color .2s",
                "&:hover": {
                  transform: "translateY(-1px)",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 10px 24px rgba(0,0,0,0.06)",
                  borderColor: alpha(accentMain, 0.24),
                },
              }}
            >
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    "&::before": {
                      content: '""',
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      // ← ドットをアクセント色のグラデーションに
                      background: `linear-gradient(180deg, ${accentLight}, ${alpha(accentMain, 0.9)})`,
                      boxShadow: `0 0 0 3px ${alpha(accentMain, 0.14)}`,
                      display: "inline-block",
                    },
                  }}
                >
                  {kpi.label}
                </Typography>

                {isLoading ? (
                  <Skeleton variant="text" height={38} sx={{ maxWidth: 120, mt: 0.25 }} />
                ) : (
                  <AutoFitNumber value={kpi.value} />
                )}
              </Stack>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}
