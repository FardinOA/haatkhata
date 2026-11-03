"use client";

import { LazyMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "../ui/core";
import { ToastProvider } from "../ui/overlays";
import { useHydrated } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";

const loadMotion = () => import("../motion-features").then((r) => r.default);

export function AuthFrame({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    if (ready) applyTheme(theme, lang);
  }, [ready, theme, lang]);
  return (
    <LazyMotion features={loadMotion} strict>
      <ToastProvider>
        {ready ? (
          children
        ) : (
          <div className="grid min-h-dvh place-items-center p-6">
            <Skeleton className="h-80 w-full max-w-md rounded-xl" />
          </div>
        )}
      </ToastProvider>
    </LazyMotion>
  );
}
