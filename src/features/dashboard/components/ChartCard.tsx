"use client";

/**
 * ChartCard
 * タイトル/サブタイトル/骨組み(Skeleton)/アニメを備えたグラフ用カード枠。
 * - Rechartsは親の高さが必須のため、ResponsiveContainer(100%×100%)＋外側で高さ固定
 * - minHeight:0 でFlex内のグラフ潰れを防止
 * - delayでフェード順制御（一覧での段階的表示）
 */

import * as React from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { ResponsiveContainer } from "recharts";
import { fadeIn, CARD_HEIGHT_PCT } from "@/features/dashboard/constants/ui";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactElement;
  delay?: number;
  loading: boolean;
  cardHeight?: { xs: string; md: string; lg: string };
};

export default function ChartCard({
  title,
  subtitle,
  children,
  delay = 0,
  loading,
  cardHeight = CARD_HEIGHT_PCT,
}: Props) {
  return (
    <motion.div {...fadeIn} transition={{ delay }}>
      <Paper variant="outlined" sx={{ p: 2, height: cardHeight, display: "flex", flexDirection: "column" }}>
        <Typography component="span" fontWeight={700} variant="subtitle1" sx={{ mb: 0.25 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>{subtitle}</Typography>}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {loading ? <Skeleton variant="rectangular" height="100%" /> : children}
          </ResponsiveContainer>
        </Box>
      </Paper>
    </motion.div>
  );
}
