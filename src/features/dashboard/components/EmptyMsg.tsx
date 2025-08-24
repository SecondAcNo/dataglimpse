"use client";

/**
 * EmptyMsg
 * -----------------------------------------------------------------------------
 * 空状態や“データなし”を簡潔に表示するための小さなメッセージView。
 * - 見た目のみ（ロジック無し）。色は text.secondary で控えめ表示。
 * - 非常に軽量なため、グラフ/リストの代替表示として気軽に使う。
 */

import * as React from "react";
import { Box } from "@mui/material";

export default function EmptyMsg({ msg }: { msg: string }) {
  return <Box sx={{ p: 2, color: "text.secondary", fontSize: 12 }}>{msg}</Box>;
}
