"use client";
/**
 * Persistent bar while a HaatKhata admin is signed in as a shop owner
 * (FR-ADM-01). Mount at the very top of the app shell.
 */
import { Eye, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initialState } from "@/lib/state";
import { useStore } from "@/lib/store";

export function ImpersonationBar() {
  const mode = useStore((s) => s.sync.mode);
  const businessName = useStore((s) => s.business.name);
  const [by, setBy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (mode !== "account") return;
    let live = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setBy(d?.impersonatedBy ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mode]);

  if (!by || mode !== "account") return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center gap-3 bg-[#2b1a00] px-4 py-2 text-[13px] text-[#FDF1D9] md:px-6" role="status">
      <Eye className="size-4 shrink-0 text-cash" weight="fill" />
      <span className="min-w-0 flex-1 truncate">
        You are signed in as the owner of <b className="font-semibold text-white">{businessName}</b>. Everything you do is logged.
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/auth/impersonation/exit", { method: "POST" })
            .then((res) => res.json())
            .catch(() => ({}));
          // Drop the owner's data from this device; the admin console tab is still signed in.
          useStore.setState((s) => Object.assign(s, initialState()));
          if (window.opener) window.close();
          if (r.adminUrl) window.location.href = r.adminUrl;
          else router.replace("/login");
        }}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-cash px-3 font-semibold text-[#2b1a00] hover:brightness-105 disabled:opacity-60"
      >
        <SignOut className="size-4" />
        Exit
      </button>
    </div>
  );
}
