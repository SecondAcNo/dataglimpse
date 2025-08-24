"use client";

import * as React from "react";
type HtmlToImage = typeof import("html-to-image");

/**
 * ExportOptions
 * -----------------------------------------------------------------------------
 * ER 図のエクスポート処理を制御するオプション群。
 * - backgroundColor : 背景色（"transparent" を指定すれば透過出力）
 * - pixelRatio      : 出力解像度倍率（2〜3推奨。高すぎると描画コスト増）
 * - excludeSelectors: 出力対象から除外する CSS セレクタ（UI部品や装飾を外すのに利用）
 * - asBlob          : true の場合 Blob オブジェクトを返す（ダウンロード用途）
 * - skipFonts       : Webフォント埋め込みをスキップ（既定: true、安全性/パフォーマンス優先）
 */
export type ExportOptions = {
  backgroundColor?: string;
  pixelRatio?: number;
  excludeSelectors?: string[];
  asBlob?: boolean;
  skipFonts?: boolean;
};

/**
 * useERExporter
 * -----------------------------------------------------------------------------
 * React Flow 上で描画される ER 図を PNG/SVG としてエクスポートするためのカスタムフック。
 *
 * 機能:
 * - `setContainerRef` : ER 図のルート要素を参照にセット
 * - `toSVG` / `toPNG`: データURL または Blob 形式での変換
 * - `downloadSVG` / `downloadPNG`: 即時ダウンロード用ユーティリティ
 *
 * 注意点:
 * - 大規模なダイアグラムでは描画コストが高く、ブラウザのメモリ上限にかかる可能性あり
 * - `pixelRatio` を上げすぎるとレンダリングが極端に遅くなるため実用範囲は 2〜3 倍
 * - Safari など一部ブラウザではフォント埋め込みや foreignObject の互換性問題が出やすい
 */
export function useERExporter() {
  // ---------------------------------------------------------------------------
  // ref: エクスポート対象のルート要素（ER 図の外枠）を保持
  // ---------------------------------------------------------------------------
  const containerRef = React.useRef<HTMLElement | null>(null);
  const setContainerRef = React.useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  // ---------------------------------------------------------------------------
  // getViewportEl:
  // React Flow の内部構造を考慮し、実際にエクスポートすべき DOM ノードを取得。
  // - 基本的には `.react-flow__viewport` を優先
  // - 存在しない場合はコンテナ自身を fallback として返す
  // ---------------------------------------------------------------------------
  const getViewportEl = React.useCallback((): HTMLElement | null => {
    const root = containerRef.current;
    if (!root) return null;
    const vp = root.querySelector(".react-flow__viewport") as HTMLElement | null;
    return vp ?? root;
  }, []);

  // ---------------------------------------------------------------------------
  // buildFilter:
  // html-to-image の filter API に渡す関数を生成。
  // - React Flow 固有の UI コンポーネント（minimap, controls, panel, background）を除外
  // - 任意に指定した CSS セレクタ・data-noexport 属性を持つ要素も除外
  //   => エクスポート対象を「ER 図の本体」に限定する役割
  // ---------------------------------------------------------------------------
  const buildFilter = React.useCallback(
    (excludeSelectors: string[] = []) =>
      (node: HTMLElement) => {
        const el = node as HTMLElement;
        if (
          el.closest?.(".react-flow__minimap") ||
          el.closest?.(".react-flow__controls") ||
          el.closest?.(".react-flow__panel") ||
          el.closest?.(".react-flow__background") // グリッド背景
        ) return false;
        for (const sel of excludeSelectors) if (el.closest?.(sel)) return false;
        if ((el.dataset && el.dataset.noexport) === "true") return false;
        return true;
      },
    []
  );

  // ---------------------------------------------------------------------------
  // toSVG:
  // ER 図を SVG 形式の DataURL または Blob として生成。
  // foreignObject を含むため、フォント互換性に注意。
  // ---------------------------------------------------------------------------
  const toSVG = React.useCallback(async (opts: ExportOptions = {}) => {
    const el = getViewportEl();
    if (!el) throw new Error("Export target not found.");
    const mod: HtmlToImage = await import("html-to-image");

    const {
      backgroundColor = "transparent",
      pixelRatio = 2,
      excludeSelectors = [],
      asBlob = false,
      skipFonts = true,
    } = opts;

    const filter = buildFilter(excludeSelectors);
    const dataUrl = await mod.toSvg(el, {
      backgroundColor,
      pixelRatio,
      cacheBust: true,
      filter: (n) => filter(n as HTMLElement),
      skipFonts,
    });

    if (asBlob) {
      const res = await fetch(dataUrl);
      return await res.blob(); // image/svg+xml
    }
    return dataUrl;
  }, [getViewportEl, buildFilter]);

  // ---------------------------------------------------------------------------
  // downloadSVG:
  // toSVG() の結果を自動的にダウンロードリンク化して即保存するユーティリティ。
  // ---------------------------------------------------------------------------
  const downloadSVG = React.useCallback(
    async (filename = "er-diagram.svg", opts: ExportOptions = {}) => {
      const out = await toSVG({ ...opts, asBlob: true });
      const blob = out as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [toSVG]
  );

  // ---------------------------------------------------------------------------
  // toPNG:
  // ER 図を PNG 形式の DataURL または Blob として生成。
  // - Office/LibreOffice との相性が良く、業務用途では SVG より安定
  // - 背景透過も可能（デフォルト）
  // ---------------------------------------------------------------------------
  const toPNG = React.useCallback(async (opts: ExportOptions = {}) => {
    const el = getViewportEl();
    if (!el) throw new Error("Export target not found.");
    const mod: HtmlToImage = await import("html-to-image");

    const {
      backgroundColor = "transparent",
      pixelRatio = 2,
      excludeSelectors = [],
      asBlob = false,
      skipFonts = true,
    } = opts;

    const filter = buildFilter(excludeSelectors);
    const dataUrl = await mod.toPng(el, {
      backgroundColor,
      pixelRatio,
      cacheBust: true,
      filter: (n) => filter(n as HTMLElement),
      skipFonts,
    });

    if (asBlob) {
      const res = await fetch(dataUrl);
      return await res.blob(); // image/png
    }
    return dataUrl;
  }, [getViewportEl, buildFilter]);

  // ---------------------------------------------------------------------------
  // downloadPNG:
  // toPNG() の結果を自動的にダウンロードリンク化して即保存するユーティリティ。
  // ---------------------------------------------------------------------------
  const downloadPNG = React.useCallback(
    async (filename = "er-diagram.png", opts: ExportOptions = {}) => {
      const out = await toPNG({ ...opts, asBlob: true });
      const blob = out as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [toPNG]
  );

  // 公開API
  return { setContainerRef, toSVG, downloadSVG, toPNG, downloadPNG };
}
