"use client";

import * as React from "react";
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Node, type Edge, type NodeTypes, type NodeProps,
  type NodeChange, type EdgeChange, type Connection,
  type DefaultEdgeOptions, type ConnectionLineComponentProps,
  ConnectionMode
} from "reactflow";
import {
  Paper, Stack, Typography, Box, Chip, Alert, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Menu, MenuItem
} from "@mui/material";

import * as T from "../domain/type";
import { useERExporter } from "../hooks/useERExporter";

/* ───── ハンドルID ───── */
/**
 * 列ハンドルの一意なIDを生成するユーティリティ。
 * ReactFlowのエッジ接続ポイントとして利用される。
 * - 左側ハンドル: "hL-列名"
 * - 右側ハンドル: "hR-列名"
 */
const colHandleIdL = (col: string): string => `hL-${col}`;
const colHandleIdR = (col: string): string => `hR-${col}`;

/* ───── 列行（Handles付き） ───── */
/**
 * テーブル列を1行として描画するコンポーネント。
 * - 列名、データ型、主キー/ユニーク/外部キーのバッジ表示を行う。
 * - 左右にHandleを配置し、他テーブルとのリレーション接続を可能にする。
 */
type ColumnRowProps = {
  name: string; dataType: string; isPK: boolean; isUnique: boolean; showFkBadge: boolean;
};
function ColumnRow({ name, dataType, isPK, isUnique, showFkBadge }: ColumnRowProps): React.JSX.Element {
  const emphasized = showFkBadge; // 外部キー列の場合、行を強調表示する
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1, position: "relative",
      py: 0.25, borderRadius: 1, px: 0.5,
      ...(emphasized && { backgroundColor: "rgba(255,255,255,0.06)", outline: "1px dashed rgba(255,255,255,0.12)" }),
    }}>
      {/* 左右にエッジ接続用ハンドル */}
      <Handle id={colHandleIdL(name)} type="source" position={Position.Left} style={{ left: -8, top: "50%", transform: "translateY(-50%)" }} />
      <Handle id={colHandleIdR(name)} type="source" position={Position.Right} style={{ right: -8, top: "50%", transform: "translateY(-50%)" }} />
      <span>{name}</span>
      {/* PK/UQ/FK のバッジ表示 */}
      {isPK ? <Chip size="small" label="PK" /> : isUnique ? <Chip size="small" variant="outlined" label="Unique" /> : null}
      {showFkBadge && <Chip size="small" variant="outlined" label="FK" />}
      <Box sx={{ ml: "auto", color: "text.secondary" }}>{dataType}</Box>
    </Box>
  );
}

/* ───── テーブルノード表示 ───── */
/**
 * ReactFlow上に配置される「テーブルノード」。
 * - テーブル名 + 複数列（ColumnRow）を描画する。
 * - NodeProps経由で受け取ったTableNodeDataをUIに反映。
 */
function TableNode({ data }: NodeProps<T.TableNodeData>): React.JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 320, position: "relative" }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>{data.name}</Typography>
      <Box sx={{ fontSize: 12, lineHeight: 1.9 }}>
        {data.columns.map((c) => (
          <ColumnRow
            key={c.name}
            name={c.name}
            dataType={c.dataType}
            isPK={data.effPk.has(c.name)}
            isUnique={data.effUnique.has(c.name)}
            showFkBadge={data.effFkBadge.has(c.name)}
          />
        ))}
      </Box>
    </Paper>
  );
}
const nodeTypes: NodeTypes = { tableNode: TableNode };

/* ───── 列編集ダイアログ ───── */
/**
 * 列ごとのメタ情報（PK/UQ/FKバッジ）の上書きをユーザー操作で設定できるダイアログ。
 * - 「列名」「型」「PK/UQ/FKチェックボックス」を表示。
 * - 手動設定を全クリアするボタンあり。
 */
type ColumnEditDialogProps = {
  open: boolean; onClose: () => void; table: T.TableMetaView | null;
  overrides: T.Overrides; defaultBadgeCols: Set<string>;
  setColumnOverride: (table: string, col: string, patch: T.ColumnOverridePatch) => void;
  clearTableOverrides: (table: string) => void;
};
function ColumnEditDialog({
  open, onClose, table, overrides, defaultBadgeCols, setColumnOverride, clearTableOverrides,
}: ColumnEditDialogProps): React.JSX.Element | null {
  if (!table) return null;
  const tOv = overrides[table.name] ?? {};
  const isB = (v: unknown): v is boolean => typeof v === "boolean";

  /** 列単位で指定キーの真偽値をトグルする */
  const toggle = (col: string, key: keyof T.ColumnOverridePatch, effectiveDefault: boolean): void => {
    const current = tOv[col]?.[key];
    const effective = isB(current) ? current : effectiveDefault;
    setColumnOverride(table.name, col, { [key]: !effective });
  };
  /** 当該テーブルの全手動オーバーライドを削除 */
  const reset = (): void => clearTableOverrides(table.name);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{table.name} の列を編集</DialogTitle>
      <DialogContent>
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>列名</TableCell>
              <TableCell>型</TableCell>
              <TableCell align="center">PK</TableCell>
              <TableCell align="center">Unique</TableCell>
              <TableCell align="center">FK</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {table.columns.map((c) => {
              const o = tOv[c.name] ?? {};
              const pkDefault = c.name.toLowerCase() === "id"; // id列はPKとみなす
              const uqDefault = false;
              const badgeDefault = defaultBadgeCols.has(c.name);
              const pk = isB(o?.isPk) ? o.isPk : pkDefault;
              const uq = isB(o?.isUnique) ? o.isUnique : uqDefault;
              const badge = isB(o?.fkBadge) ? o.fkBadge : badgeDefault;
              return (
                <TableRow key={c.name} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.dataType}</TableCell>
                  <TableCell align="center"><Checkbox checked={pk} onChange={() => toggle(c.name, "isPk", pkDefault)} /></TableCell>
                  <TableCell align="center"><Checkbox checked={uq} onChange={() => toggle(c.name, "isUnique", uqDefault)} /></TableCell>
                  <TableCell align="center"><Checkbox checked={badge} onChange={() => toggle(c.name, "fkBadge", badgeDefault)} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button color="warning" variant="outlined" onClick={reset}>このテーブルの手動設定をクリア</Button>
        <Button variant="contained" onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───── 線スタイル編集ダイアログ ───── */
/**
 * エッジ（リレーション線）の見た目（曲線種別/実線・破線/色/太さ/矢印有無）を編集できるダイアログ。
 * - 個別エッジごとに適用される。
 * - デフォルトスタイルへリセット / エッジ削除の機能あり。
 */
type EdgeStyleDialogProps = {
  open: boolean; value: T.EdgeStyleConfig; onClose: () => void;
  onChange: (v: T.EdgeStyleConfig) => void; onDelete: () => void; onResetDefault: () => void;
};
function EdgeStyleDialog({ open, value, onClose, onChange, onDelete, onResetDefault }: EdgeStyleDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>線のスタイル</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {/* 編集UIは素朴に input/select を使用 */}
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ width: 120 }}>種類</Typography>
            <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as T.EdgeCurveType })}>
              <option value="smoothstep">smoothstep</option>
              <option value="step">step</option>
              <option value="bezier">bezier</option>
              <option value="straight">straight</option>
            </select>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ width: 120 }}>線種</Typography>
            <Stack direction="row" spacing={3}>
              <label><input type="radio" name="dash-kind" checked={!value.dashed} onChange={() => onChange({ ...value, dashed: false })} /> 実線</label>
              <label><input type="radio" name="dash-kind" checked={value.dashed} onChange={() => onChange({ ...value, dashed: true })} /> 破線</label>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ width: 120 }}>色</Typography>
            <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ width: 120 }}>太さ</Typography>
            <input type="range" min={1} max={6} value={value.width} onChange={(e) => onChange({ ...value, width: Number(e.target.value) })} />
            <Typography>{value.width}px</Typography>
          </Stack>
          <Stack direction="row" spacing={3}>
            <label><input type="checkbox" checked={value.arrowStart} onChange={(e) => onChange({ ...value, arrowStart: e.target.checked })} /> 始点矢印</label>
            <label><input type="checkbox" checked={value.arrowEnd} onChange={(e) => onChange({ ...value, arrowEnd: e.target.checked })} /> 終点矢印</label>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onResetDefault}>デフォルトに戻す</Button>
        <Button color="error" onClick={onDelete}>この線を削除</Button>
        <Button variant="contained" onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ───── Props ───── */
/**
 * ERPageViewコンポーネントのProps。
 * - ReactFlow用のnodes/edgesや、編集中テーブル・エッジの情報を受け取る。
 * - 親コンテナで状態管理し、このViewは純粋に表示・操作イベントを担う。
 */
type Props = {
  loading: boolean; error: string | null; empty: boolean;
  nodes: Node<T.TableNodeData>[]; edges: Edge[]; connectionMode: ConnectionMode;
  defaultEdgeOptions: DefaultEdgeOptions;
  onNodesChange: (changes: NodeChange[]) => void; onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void; onEdgeClick: (e: React.MouseEvent, edge: Edge) => void;
  onNodeClick: (e: React.MouseEvent, node: Node<T.TableNodeData>) => void;
  onReload: () => void | Promise<void>; onResetLayout: () => void; onApplyAuto: () => void;
  pendingAdds: number;
  editTable: T.TableMetaView | null; onCloseEditTable: () => void;
  overrides: T.Overrides; setColumnOverride: (table: string, col: string, patch: T.ColumnOverridePatch) => void;
  clearTableOverrides: (table: string) => void; defaultBadgeCols: Set<string>;
  editingEdgeKey: string | null; editingStyle: T.EdgeStyleConfig;
  setEditingStyle: (v: T.EdgeStyleConfig) => void; resetEditingStyleToDefault: () => void;
  deleteEditingEdge: () => void; closeEditingEdge: () => void;
  ConnectionLineComponent: React.ComponentType<ConnectionLineComponentProps>;
};

/* ───── View ───── */
/**
 * ER図全体を表示するメインViewコンポーネント。
 * - ツールバー（再読込・レイアウト初期化・画像出力など）
 * - ReactFlowキャンバス（ノード/エッジ描画）
 * - 列編集ダイアログ
 * - エッジスタイル編集ダイアログ
 * を統合する。
 */
export default function ERPageView(props: Props): React.JSX.Element {
  const {
    loading, error, empty, nodes, edges, connectionMode, defaultEdgeOptions,
    onNodesChange, onEdgesChange, onConnect, onEdgeClick, onNodeClick,
    onReload, onResetLayout, onApplyAuto, pendingAdds,
    editTable, onCloseEditTable, overrides, setColumnOverride, clearTableOverrides, defaultBadgeCols,
    editingEdgeKey, editingStyle, setEditingStyle, resetEditingStyleToDefault, deleteEditingEdge, closeEditingEdge,
    ConnectionLineComponent,
  } = props;

  // Exporter (SVG/PNG出力)
  const { setContainerRef, downloadSVG, downloadPNG } = useERExporter();
  const paperRef = React.useCallback((el: HTMLDivElement | null) => setContainerRef(el), [setContainerRef]);

  // 画像出力メニューの状態管理
  const [exportAnchorEl, setExportAnchorEl] = React.useState<null | HTMLElement>(null);
  const openExportMenu = (e: React.MouseEvent<HTMLButtonElement>) => setExportAnchorEl(e.currentTarget);
  const closeExportMenu = () => setExportAnchorEl(null);

  const handleExportSvg = async () => { closeExportMenu(); await downloadSVG("er-diagram.svg"); };
  const handleExportPngTransparent = async () => { closeExportMenu(); await downloadPNG("er-diagram.png", { pixelRatio: 2 }); };

  return (
    <Stack spacing={2}>
      {/* ヘッダーツールバー */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        data-noexport="true" // エクスポート対象外にする
      >
        <Typography variant="h5" fontWeight={800}>ER</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" onClick={onApplyAuto} disabled={pendingAdds === 0}>
            自動候補を追加（{pendingAdds}本）
          </Button>
          <Button size="small" variant="outlined" onClick={onResetLayout}>レイアウト初期化</Button>
          <Button size="small" variant="outlined" onClick={onReload}>再読込</Button>

          {/* Exportボタン（メニュー展開） */}
          <Button size="small" variant="contained" color="primary" onClick={openExportMenu}>
            画像出力
          </Button>
          <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={closeExportMenu}>
            <MenuItem onClick={handleExportSvg}>SVG（透過）</MenuItem>
            <MenuItem onClick={handleExportPngTransparent}>PNG（透過）</MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* 状態別メッセージ */}
      {loading && <Alert severity="info">読み込み中...</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {empty && !loading && !error && <Alert severity="warning">テーブルが見つかりません。まずダッシュボードでCSVを取り込んでください。</Alert>}

      {/* ReactFlowキャンバス */}
      <Paper ref={paperRef} variant="outlined" sx={{ height: "72vh", display: empty || !!error ? "none" : "block" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable
          panOnDrag
          zoomOnScroll
          connectionMode={connectionMode}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineComponent={ConnectionLineComponent}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </Paper>

      {/* 列編集ダイアログ */}
      <ColumnEditDialog
        open={!!editTable}
        onClose={onCloseEditTable}
        table={editTable}
        overrides={overrides}
        defaultBadgeCols={defaultBadgeCols}
        setColumnOverride={setColumnOverride}
        clearTableOverrides={clearTableOverrides}
      />

      {/* 線スタイル編集ダイアログ */}
      <EdgeStyleDialog
        open={!!editingEdgeKey}
        value={editingStyle}
        onClose={closeEditingEdge}
        onChange={setEditingStyle}
        onDelete={deleteEditingEdge}
        onResetDefault={resetEditingStyleToDefault}
      />
    </Stack>
  );
}
