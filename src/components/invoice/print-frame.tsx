"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { Suspense, useEffect, type ReactNode } from "react";
import { Skeleton } from "../ui/core";
import { ToastProvider } from "../ui/overlays";
import { useHydrated, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";

/** Full-screen print layout outside the app shell: hydrates the store, applies the brand theme. */
export function PrintFrame({ children }: { children: () => ReactNode }) {
  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>
        <Gate>{children}</Gate>
      </Suspense>
    </ToastProvider>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6" aria-busy="true">
      <Skeleton className="h-[70vh] w-full max-w-[640px] rounded-lg" />
    </div>
  );
}

function Gate({ children }: { children: () => ReactNode }) {
  const ready = useHydrated();
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    if (ready) applyTheme(theme, lang);
  }, [ready, theme, lang]);
  return ready ? <>{children()}</> : <Loading />;
}

/** Sticky toolbar that disappears when printing. */
export function PrintToolbar({ back, title, sub, children }: { back: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  const t = useT();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <Link href={back} className="grid size-10 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label={t("Back", "পেছনে")}>
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold text-ink">{title}</h1>
          {sub && <p className="truncate text-[13px] text-ink-3">{sub}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
