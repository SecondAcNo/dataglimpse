// =============================================================================
// ER (Entity Relationship) ドメイン型定義
// - DBスキーマ/メタ情報とUI描画用情報を横断的に定義する
// - 依存関係は一切持たず、純粋に型の集約のみを行う
// - ReactFlowなど外部ライブラリ依存の型はここには含めない
// =============================================================================

/* ============================================================================
 * DB メタ情報型
 * ============================================================================
 */

/**
 * 単一列のメタ情報（DBスキーマ由来）
 * - SQLiteの pragma や information_schema 相当の情報を表す
 */
export type ColumnMeta = {
  /** 列名 */
  name: string;

  /** DBに登録されている型 (例: "INTEGER", "TEXT") */
  dataType: string;

  /** 一意かつ NOT NULL 制約が付与されている場合 true */
  uniqueNoNull: boolean;

  /** この列が PK の一部である場合 true */
  isPk: boolean;
};

/**
 * テーブルのメタ情報
 * - 列メタを包含する
 */
export type TableMeta = {
  /** テーブル名 */
  name: string;

  /** 列情報一覧 */
  columns: ColumnMeta[];
};

/**
 * 外部キー関係を表現する最小単位
 * - fromTable.fromColumn → toTable.toColumn
 */
export type FKTuple = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
};

/* ============================================================================
 * UI / 描画用 型
 * ============================================================================
 */

/**
 * UI描画用に最小化された列情報
 * - データベース制約は除外し、表示用に必要な属性のみ保持
 */
export type ColumnMetaView = {
  name: string;
  dataType: string;
};

/**
 * UI描画用のテーブル情報
 * - ER図にノードとして描画する際に利用
 */
export type TableMetaView = {
  name: string;
  columns: ColumnMetaView[];
};

/**
 * テーブルノードに対して、オーバライド適用済みの状態を付与した型
 * - UI の強調表示やバッジ表示に利用する
 */
export type TableNodeData = TableMetaView & {
  /** 有効な主キー列集合 */
  effPk: Set<string>;
  /** 有効な一意制約列集合 */
  effUnique: Set<string>;
  /** 外部キー候補バッジ表示対象列集合 */
  effFkBadge: Set<string>;
};

/* ============================================================================
 * エッジ（線）関連の型
 * ============================================================================
 */

/** 線の曲線スタイルの種類 */
export type EdgeCurveType = "smoothstep" | "step" | "bezier" | "straight";

/**
 * 1 本のエッジに対するスタイル設定
 * - ReactFlow エッジ描画スタイルに相当
 */
export type EdgeStyleConfig = {
  /** 線種 */
  type: EdgeCurveType;
  /** 線色 */
  color: string;
  /** 破線フラグ */
  dashed: boolean;
  /** 線の太さ(px) */
  width: number;
  /** 始点側に矢印を描画するか */
  arrowStart: boolean;
  /** 終点側に矢印を描画するか */
  arrowEnd: boolean;
};

/**
 * 外部キー識別子（"from.tbl.col -> to.tbl.col"）をキーにした線スタイルマップ
 */
export type EdgeStyleMap = Record<string, EdgeStyleConfig>;

/* ============================================================================
 * 手動 FK / 接続ハンドル
 * ============================================================================
 */

/** ハンドルの配置方向 */
export type HandleSide = "L" | "R";

/**
 * ユーザーが手動で追加した外部キー
 * - 接続位置 (L/R) も保持し、UI上での位置再現を可能にする
 */
export type ManualFK = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  fromSide?: HandleSide;
  toSide?: HandleSide;
};

/**
 * キー生成など内部利用用の最小 FK 表現
 */
export type FkTupleLocal = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
};

/* ============================================================================
 * 列オーバライド関連
 * ============================================================================
 */

/**
 * 単一列に対するオーバライドパッチ
 * - 未指定のフィールドはデフォルトのまま据え置き
 */
export type ColumnOverridePatch = {
  /** PK として強制するか */
  isPk?: boolean;
  /** Unique として強制するか */
  isUnique?: boolean;
  /** *_id 類推に基づく FK バッジ表示を強制 ON/OFF */
  fkBadge?: boolean;
};

/**
 * テーブル単位のオーバライド設定
 * - { [table]: { [column]: patch } } の入れ子構造
 */
export type Overrides = {
  [table: string]: {
    [column: string]: ColumnOverridePatch;
  };
};
