"use client";

import * as React from "react";
import "reactflow/dist/style.css";
import ERPageView from "../views/ERPageView";
import { useERPageViewModel } from "../hooks/useERPageViewModel";
import { ArrowConnectionLine } from "../components/ArrowConnectionLine";
import type { JSX } from "react";

export default function ERPageContainer(): JSX.Element {
  // ViewModel（状態とハンドラ一式）
  const vm = useERPageViewModel();

  // 必須の ConnectionLineComponent を明示的に渡す
  return <ERPageView {...vm} ConnectionLineComponent={ArrowConnectionLine} />;
}
