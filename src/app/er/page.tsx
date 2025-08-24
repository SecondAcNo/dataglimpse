"use client";

import * as React from "react";
import ERPageContainer from "@/features/er/containers/ERPageContainer";
import { JSX } from "react";

/**
 * ER Page (App Router entrypoint)
 * - 単に Container を呼び出すだけ
 * - SSR/Suspense などの仕込みが必要ならここで行う
 */
export default function ERPage(): JSX.Element {
  return <ERPageContainer />;
}
