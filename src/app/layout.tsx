import type { Metadata } from "next";
import ClientProviders from "./providers";
import AppShell from "@/components/layout/AppShell";
import { SnackbarProvider } from "@/components/providers/SnackbarProvider";
import AppErrorBoundary from "@/components/common/AppErrorBoundary";

export const metadata: Metadata = {
  title: "DataGlimpse",
  description: "瞬間データルーム：CSV→プレビュー→SQL→ER",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ClientProviders>
          <SnackbarProvider>
            <AppErrorBoundary>
              <AppShell>{children}</AppShell>
            </AppErrorBoundary>
          </SnackbarProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
