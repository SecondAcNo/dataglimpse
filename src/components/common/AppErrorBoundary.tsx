"use client";
import React from "react";

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>問題が発生しました</h2>
          <p>ページを再読み込みしてください。改善しない場合はCSVやSQL内容をご確認ください。</p>
          <button onClick={() => location.reload()}>再読み込み</button>
        </div>
      );
    }
    return this.props.children;
  }
}
