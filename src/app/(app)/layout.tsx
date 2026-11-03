import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";

// The app is local-first: every screen reads the on-device store, which only
// exists in the browser. The first paint waits for it (the shell shows a
// skeleton); client-side navigation afterwards is immediate.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
