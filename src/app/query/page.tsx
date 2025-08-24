"use client";

import { Suspense } from "react";
import QueryPageContainer from "@/features/query/containers/QueryPageContainer";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <QueryPageContainer />
    </Suspense>
  );
}