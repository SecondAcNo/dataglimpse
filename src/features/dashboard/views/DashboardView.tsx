"use client";

/**
 * DashboardView
 * -----------------------------------------------------------------------------
 * 役割:
 *  - 受け取った props を元に UI を“描画だけ”行うプレゼンテーション層。
 *  - 状態取得/破壊操作などのロジックは Container 側に委譲。
 */

import * as React from "react";
import { Box, Stack, Typography, List, ListItem, ListItemText } from "@mui/material";
import Grid from "@mui/material/Grid";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ComposedChart, Line, RadialBarChart, RadialBar,
  Area, CartesianGrid, ReferenceLine, Cell
} from "recharts";
import { alpha, useTheme } from "@mui/material/styles";
import KpiStrip from "@/features/dashboard/components/KpiStrip";
import CsvImportPanel from "@/features/dashboard/components/CsvImportPanel";
import TableListPanel, { type TableListItem } from "@/features/dashboard/components/TableListPanel";
import ChartCard from "@/features/dashboard/components/ChartCard";
import RenameDialog from "@/components/common/RenameDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import BarGradients from "@/features/dashboard/components/BarGradients";
import HighlightColors from "@/features/dashboard/components/HighlightColors";
import SizeDonutTooltip from "@/features/dashboard/components/SizeDonutTooltip";
import EmptyMsg from "@/features/dashboard/components/EmptyMsg";
import {
  BAR_SIZE, BAR_RADIUS, GRID_DASH, YAXIS_LABEL_WIDTH,
  FK_COVERAGE_GOOD_THRESHOLD, CORR_TICK_COUNT, RADIAL,
} from "@/features/dashboard/constants/chart";
import { CARD_HEIGHT_PCT, fadeIn, FADEIN_DELAY_BASE } from "@/features/dashboard/constants/ui";
import { CONFIRM_LIST_PREVIEW_MAX } from "@/features/dashboard/constants/table";

// ---- 型定義（View が実際に利用するフィールドのみに限定） ----
export type TypeDistEntry = {
  table: string;
  INTEGER?: number;
  REAL?: number;
  NUMERIC?: number;
  TEXT?: number;
};
export type UniqueTopEntry = { name: string; ratio: number };
export type ParetoSeriesPoint = { category: string; count: number; cum: number };
export type CorrTopEntry = { pair: string; corrAbs: number };
export type FkCoverageBar = { name: string; coveragePct: number };

// useTableSelection の「View が使うプロパティだけ」を表す型
export type SelectionViewModel = {
  filter: string;
  setFilter: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  startIndex: number;
  filteredCount: number;
  pageItems: TableListItem[];
  selected: Set<string>;
  toggleSelect: (name: string) => void;
  selectPage: () => void;
  clearSelection: () => void;
};

type Props = {
  // 基本状態
  tables: string[];
  loading: boolean;

  // 各カードのグラフデータ
  typeDist: TypeDistEntry[];
  uniqueTop: UniqueTopEntry[];
  pareto: { data: ParetoSeriesPoint[] };
  corrTop: CorrTopEntry[];
  fkCoverageBars: FkCoverageBar[];
  corrDomain: [number, number];

  // リロード
  reload: () => Promise<void>;

  // KPI
  kpis: { totalRows: number; totalCols: number; avgCols: number; fkCount: number };

  // Container で計算済みの派生データ
  derived: {
    topRows: { name: string; rows: number }[];
    sizeTop: { name: string; rows: number; cols: number; score: number; fill: string }[];
    completenessWorst: { name: string; completeness: number; nullRate: number }[];
    outboundTop: { name: string; count: number }[];
  };

  // 一覧/選択
  selection: SelectionViewModel;

  // アクション（破壊操作は Container へ委譲）
  actions: {
    dropOne: (name: string) => Promise<void>;
    dropMany: (names: string[]) => Promise<void>;
    rename: (from: string, to: string) => Promise<void>;
  };
};

export function DashboardView({
  tables, loading, typeDist, uniqueTop, pareto, corrTop, fkCoverageBars, corrDomain, reload,
  kpis, derived, selection, actions
}: Props) {
  const theme = useTheme();

  // ダイアログ用ローカル状態（Viewに閉じ込め）
  const [renaming, setRenaming] = React.useState<string | null>(null);//変更中のテーブル名
  const [bulkOpen, setBulkOpen] = React.useState(false);//一括削除確認ダイアログフラグ

  // 橋渡しハンドラ
  const handleDelete = async (name: string) => { await actions.dropOne(name); };
  const doRename = async (next: string) => { if (!renaming) return; await actions.rename(renaming, next); setRenaming(null); };
  const doBulkDelete = async () => { setBulkOpen(false); await actions.dropMany([...selection.selected]); };

  // ---- Tooltip の共通スタイル（ダーク/ライト両対応） ----
  const tooltipProps = React.useMemo(() => {
  const bgDark = "#2f2f2f"; // 画像に合わせた濃いグレー
  return {
    contentStyle: {
      // ※ default Tooltip のみ有効
      backgroundColor: theme.palette.mode === "dark" ? bgDark : "#fff",
      color: theme.palette.text.primary,
      border: `0px solid ${alpha("#000", 0)}`,
      borderRadius: 12,
      boxShadow: theme.shadows[4],
    } as React.CSSProperties,
    labelStyle: { color: theme.palette.text.primary } as React.CSSProperties,
    itemStyle: { color: theme.palette.text.primary } as React.CSSProperties,
    wrapperStyle: { outline: "none" } as React.CSSProperties,
  };
}, [theme]);

  // ---- カード定義（宣言的に並べる）----
  const cards: { title: string; subtitle: string; render: () => React.ReactElement }[] = [
    {
      title: "テーブル別 行数TOP",
      subtitle: "どのテーブルが巨大かを把握（上位）",
      render: () => (
        <BarChart data={derived.topRows} layout="vertical">
          <BarGradients />
          <HighlightColors />
          <CartesianGrid stroke="url(#dgGrid)" strokeDasharray={GRID_DASH} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={YAXIS_LABEL_WIDTH.rowsTop} />
          <Tooltip {...tooltipProps} />
          <Bar dataKey="rows" barSize={BAR_SIZE} radius={BAR_RADIUS} fill="url(#dgBlue)" />
        </BarChart>
      ),
    },
    {
      title: "データ完全性ワースト",
      subtitle: "完全性（100−欠損率）が低い順（%）",
      render: () => (
        <ComposedChart data={derived.completenessWorst}>
          <BarGradients />
          <HighlightColors />
          <XAxis dataKey="name" hide />
          <YAxis unit="%" domain={[0, 100]} />
          <Tooltip {...tooltipProps} />
          <Bar dataKey="nullRate" barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="rgba(33,150,243,.18)" />
          <Bar dataKey="completeness" barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="url(#dgBlue)" />
        </ComposedChart>
      ),
    },
    {
      title: "子テーブルのFK列数TOP",
      subtitle: "多くの参照（*_id）を持つか（件）",
      render: () => (
        derived.outboundTop.length > 0 ? (
          <BarChart data={derived.outboundTop} layout="vertical">
            <BarGradients />
            <HighlightColors />
            <CartesianGrid stroke="url(#dgGrid)" strokeDasharray={GRID_DASH} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={YAXIS_LABEL_WIDTH.outboundTop} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" barSize={BAR_SIZE} radius={BAR_RADIUS} fill="url(#dgBlue)" />
          </BarChart>
        ) : <EmptyMsg msg="FK候補なし" />
      ),
    },
    {
      title: "数値列 相関TOP",
      subtitle: "同一テーブル内の数値ペア相関（|r|%）",
      render: () => (
        corrTop.length > 0 ? (
          <ComposedChart data={corrTop}>
            <BarGradients />
            <HighlightColors />
            <CartesianGrid stroke="url(#dgGrid)" strokeDasharray={GRID_DASH} />
            <XAxis dataKey="pair" hide />
            <YAxis unit="%" domain={corrDomain} tickCount={CORR_TICK_COUNT} />
            <Tooltip {...tooltipProps} />
            <Area type="monotone" dataKey="corrAbs" fill="url(#dgBlue2)" />
            <Line type="monotone" dataKey="corrAbs" stroke="url(#dgLine)" dot={false} strokeWidth={2} />
          </ComposedChart>
        ) : <EmptyMsg msg="十分な数値列なし" />
      ),
    },
    {
      title: "列型分布（上位テーブル）",
      subtitle: "各列型の内訳",
      render: () => (
        <ComposedChart data={typeDist}>
          <BarGradients />
          <HighlightColors />
          <XAxis dataKey="table" hide />
          <YAxis />
          <Tooltip {...tooltipProps} />
          <Bar dataKey="INTEGER" barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="url(#dgBlue4)" />
          <Bar dataKey="REAL"    barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="url(#dgBlue3)" />
          <Bar dataKey="NUMERIC" barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="url(#dgBlue2)" />
          <Bar dataKey="TEXT"    barSize={BAR_SIZE} radius={BAR_RADIUS} stackId="a" fill="url(#dgBlue1)" />
        </ComposedChart>
      ),
    },
    {
      title: "サイズ感TOP（行×列スコア）",
      subtitle: "重い／要注意テーブルの目安",
      render: () => {
        if (derived.sizeTop.length === 0) return <EmptyMsg msg="テーブルなし" />;

        const gradientIds = ["dgBlue1", "dgBlue2", "dgBlue3", "dgBlue4"] as const;

        return (
          <RadialBarChart
            data={derived.sizeTop}
            cx={RADIAL.cx}
            cy={RADIAL.cy}
            innerRadius={RADIAL.inner}
            outerRadius={RADIAL.outer}
            startAngle={RADIAL.start}
            endAngle={RADIAL.end}
            margin={RADIAL.margin}
          >
            <BarGradients />

            <RadialBar dataKey="score" background={{ fill: "url(#dgTrack)" }} cornerRadius={12} isAnimationActive>
              {derived.sizeTop.map((_, i) => (
                <Cell key={i} fill={`url(#${gradientIds[i % gradientIds.length]})`} />
              ))}
            </RadialBar>

            {/* カスタムツールチップ */}
            <Tooltip content={<SizeDonutTooltip />} cursor={false} wrapperStyle={tooltipProps.wrapperStyle} />
          </RadialBarChart>
        );
      },
    },
    {
      title: "FKカバレッジ（上位関係）",
      subtitle: " *_id が親idに一致する割合（%）",
      render: () => (
        fkCoverageBars.length > 0 ? (
          <ComposedChart data={fkCoverageBars}>
            <BarGradients />
            <HighlightColors />
            <CartesianGrid stroke="url(#dgGrid)" strokeDasharray={GRID_DASH} />
            <XAxis dataKey="name" hide />
            <YAxis unit="%" domain={[0, 100]} />
            <Tooltip {...tooltipProps} />
            <ReferenceLine y={FK_COVERAGE_GOOD_THRESHOLD} stroke="url(#dgRef)" strokeDasharray="4 4" />
            <Bar dataKey="coveragePct" barSize={BAR_SIZE} radius={BAR_RADIUS} fill="url(#dgBlue)" />
          </ComposedChart>
        ) : <EmptyMsg msg="FK候補なし" />
      ),
    },
    {
      title: "ロングテール（Pareto）",
      subtitle: "カテゴリ上位と累積比（自動選択列）",
      render: () => (
        pareto.data.length > 0 ? (
          <ComposedChart data={pareto.data}>
            <BarGradients />
            <HighlightColors />
            <XAxis dataKey="category" hide />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" unit="%" />
            <Tooltip {...tooltipProps} />
            <Bar yAxisId="left" dataKey="count" barSize={BAR_SIZE} radius={BAR_RADIUS} fill="url(#dgBlue)" />
            <Line yAxisId="right" type="monotone" dataKey="cum" dot={false} stroke="url(#dgLine)" strokeWidth={2} />
          </ComposedChart>
        ) : <EmptyMsg msg="カテゴリ列なし" />
      ),
    },
    {
      title: "列別ユニーク比TOP",
      subtitle: "DISTINCT/行数×100（上位列）",
      render: () => (
        uniqueTop.length > 0 ? (
          <ComposedChart data={uniqueTop}>
            <BarGradients />
            <HighlightColors />
            <CartesianGrid stroke="url(#dgGrid)" strokeDasharray={GRID_DASH} />
            <XAxis dataKey="name" hide />
            <YAxis unit="%" domain={[0, 100]} />
            <Tooltip {...tooltipProps} />
            <ReferenceLine y={FK_COVERAGE_GOOD_THRESHOLD} stroke="url(#dgRef)" strokeDasharray="4 4" />
            <Bar dataKey="ratio" barSize={BAR_SIZE} radius={BAR_RADIUS} fill="url(#dgBlue)" />
            <Line type="monotone" dataKey="ratio" stroke="url(#dgLine)" dot={false} />
          </ComposedChart>
        ) : <EmptyMsg msg="列なし" />
      ),
    },
  ];

  //hasAnyTable を計算
  const hasAnyTable = tables.length > 0;

  // ---- return（描画のみ） ----
  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={800}>ダッシュボード</Typography>
      <KpiStrip
        loading={loading}
        items={[
          { label: "テーブル数", value: tables.length },
          { label: "総行数", value: kpis.totalRows },
          { label: "総列数", value: kpis.totalCols },
          { label: "平均列数/テーブル", value: kpis.avgCols },
          { label: "FK候補数", value: kpis.fkCount },
        ]}
      />

      <Box component={motion.div} {...fadeIn}>
        <CsvImportPanel hasAnyTable={hasAnyTable} onAfterImport={() => void reload()} />
      </Box>

      <Grid container spacing={2}>
        {/* 左：テーブル一覧パネル */}
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          <Box component={motion.div} {...fadeIn} sx={{ height: "100%" }}>
            <TableListPanel
              loading={loading}
              filter={selection.filter}
              onFilterChange={selection.setFilter}
              page={selection.page}
              totalPages={selection.totalPages}
              startIndex={selection.startIndex}
              filteredCount={selection.filteredCount}
              pageItems={selection.pageItems}
              onPageChange={selection.setPage}
              selected={selection.selected}
              onToggle={selection.toggleSelect}
              onSelectPage={selection.selectPage}
              onClearSelection={selection.clearSelection}
              onRefresh={() => void reload()}
              onOpenRename={setRenaming}
              onDelete={(name) => { void handleDelete(name); }}
              onRequestBulkDelete={() => setBulkOpen(true)}
            />
          </Box>
        </Grid>

        {/* 右：カード群（md:3列） */}
        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          <Grid container spacing={2}>
            {cards.map((c, i) => (
              <Grid key={c.title} size={{ xs: 12, md: 4 }}>
                <ChartCard
                  title={c.title}
                  subtitle={c.subtitle}
                  delay={FADEIN_DELAY_BASE * i}
                  loading={loading}
                  cardHeight={CARD_HEIGHT_PCT}
                >
                  {c.render()}
                </ChartCard>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* リネームダイアログ */}
      <RenameDialog
        open={!!renaming}
        title="テーブル名の変更"
        initialValue={renaming ?? ""}
        label="新しいテーブル名"
        onClose={() => setRenaming(null)}
        onSubmit={(value) => { void doRename(value); }}
        submitText="変更"
      />

      {/* 一括削除ダイアログ */}
      <ConfirmDialog
        open={bulkOpen}
        title="選択したテーブルを削除"
        message={
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {selection.selected.size} 件のテーブルを削除します。元に戻せません。よろしいですか？
            </Typography>
            <List dense sx={{ pt: 0 }}>
              {[...selection.selected].slice(0, CONFIRM_LIST_PREVIEW_MAX).map(n => (
                <ListItem key={n} sx={{ py: 0 }}>
                  <ListItemText primary={n} />
                </ListItem>
              ))}
              {selection.selected.size > CONFIRM_LIST_PREVIEW_MAX && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                  …他 {selection.selected.size - CONFIRM_LIST_PREVIEW_MAX} 件
                </Typography>
              )}
            </List>
          </>
        }
        onClose={() => setBulkOpen(false)}
        onConfirm={() => { void doBulkDelete(); }}
        confirmText="削除する"
        confirmColor="error"
      />
    </Stack>
  );
}

export default DashboardView;
