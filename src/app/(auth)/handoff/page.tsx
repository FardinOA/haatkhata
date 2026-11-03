"use client";

import { Eye, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { enterAccount } from "@/lib/sync";

/**
 * Where an admin console "Sign in as owner" link lands: the server has already
 * made an owner session, so this switches the device to that shop and opens it.
 */
export default function HandoffPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(async () => {
        const failed = new URLSearchParams(window.location.search).get("error");
        if (failed) throw new Error(failed);
        const r = await fetch("/api/auth/me");
        const me = r.ok ? await r.json() : null;
        if (!me?.impersonatedBy) throw new Error("This link didn't sign you in. Start again from the admin console.");
        await enterAccount(me.user.id);
        router.replace("/dashboard");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [router]);

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className={`grid size-12 place-items-center rounded-full ${error ? "bg-danger-soft text-danger" : "bg-cash-soft text-cash-ink"}`}>{error ? <WarningCircle className="size-6" weight="fill" /> : <Eye className="size-6" weight="fill" />}</span>
        <p className="font-display text-lg font-semibold text-ink">{error ? "Couldn't open the shop" : "Opening the shop as its owner…"}</p>
        <p className="text-sm text-ink-3">{error ?? "Everything you do here is logged against your admin account."}</p>
      </div>
    </div>
  );
}
