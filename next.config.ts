import type { NextConfig } from "next";

// リポジトリ名に合わせる（例: "dataglimpse"）
// GitHub Actions で NEXT_PUBLIC_BASE_PATH を環境変数として注入する予定。
const repoBase = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // GitHub Pages 静的エクスポート設定
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  ...(repoBase
    ? { basePath: repoBase, assetPrefix: `${repoBase}/` }
    : {}),

  // WASM 利用のため Node.js モジュールを除外
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
