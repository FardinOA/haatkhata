"use client";

import { ArrowsClockwise, CaretUpDown, Check, CloudArrowUp, CloudCheck, CloudSlash, Plus, SignIn, SignOut, Storefront, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, cn } from "../ui/core";
import { Menu, useToast } from "../ui/overlays";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useRoleLabel } from "../billing-admin/role-label";
import { onCommandError, useMe, useStore } from "@/lib/store";
import { enterAccount, leaveAccount, onSyncRejected, startSyncLoop, syncNow } from "@/lib/sync";

/** Starts background sync in account mode and turns refusals into readable toasts. */
export function SyncBridge() {
  const t = useT();
  const toast = useToast();
  const mode = useStore((s) => s.sync.mode);
  useEffect(() => {
    if (mode === "account") startSyncLoop();
  }, [mode]);
  useEffect(() => {
    const off1 = onCommandError((e) => toast({ tone: "warn", title: e.message }));
    const off2 = onSyncRejected((r) => toast({ tone: "warn", title: t("A change wasn't saved", "একটি পরিবর্তন সেভ হয়নি"), body: r.error }));
    return () => {
      off1();
      off2();
    };
  }, [toast, t]);
  return null;
}

/** Saved · Saving… · Offline (n waiting) · Sign in again. */
export function SyncStatus({ bold, compact }: { bold?: boolean; compact?: boolean }) {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow(15_000);
  const sync = useStore((s) => s.sync);
  const waiting = useStore((s) => s.outbox.length);
  if (sync.mode !== "account") return null;
  const signedOut = sync.error === "signed_out";
  const state = signedOut ? "signedOut" : sync.status === "offline" ? "offline" : sync.status === "error" ? "error" : waiting || sync.status === "syncing" ? "saving" : "saved";
  const meta = {
    saved: { I: CloudCheck, label: t("All changes saved", "সব সেভ হয়েছে"), tone: bold ? "text-brand-contrast/80" : "text-ok" },
    saving: { I: CloudArrowUp, label: waiting ? t(`Saving ${waiting}…`, `${f.num(waiting)}টি সেভ হচ্ছে…`) : t("Syncing…", "সিঙ্ক হচ্ছে…"), tone: bold ? "text-brand-contrast" : "text-brand-ink" },
    offline: { I: CloudSlash, label: waiting ? t(`Offline · ${waiting} waiting`, `অফলাইন · ${f.num(waiting)}টি অপেক্ষায়`) : t("Offline", "অফলাইন"), tone: "text-warn" },
    error: { I: WarningCircle, label: t("Couldn't sync — retrying", "সিঙ্ক হয়নি — আবার চেষ্টা"), tone: "text-danger" },
    signedOut: { I: SignIn, label: t("Signed out — sign in to save", "সাইন আউট — সেভ করতে সাইন ইন"), tone: "text-danger" },
  }[state];
  const I = meta.I;
  const content = (
    <>
      <I className={cn("size-4 shrink-0", state === "saving" && "animate-pulse")} weight={state === "saved" ? "fill" : "regular"} />
      {!compact && <span className="truncate">{meta.label}</span>}
      {!compact && state === "saved" && sync.lastSyncAt && <span className="ml-auto shrink-0 text-[11px] opacity-70">{f.relative(sync.lastSyncAt, nowMs)}</span>}
    </>
  );
  const cls = cn("flex h-8 w-full items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors", meta.tone, bold ? "hover:bg-white/10" : "hover:bg-sunken", compact && "justify-center px-0");
  return signedOut ? (
    <Link href="/login" className={cls} title={meta.label}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={() => void syncNow()} title={t("Sync now", "এখনই সিঙ্ক")}>
      {content}
    </button>
  );
}

type Biz = { id: string; name: string; role: string };

/** Account mode: who you are, which shop, switch shops, sign out. */
export function AccountMenu({ collapsed, bold }: { collapsed: boolean; bold: boolean }) {
  const t = useT();
  const router = useRouter();
  const me = useMe();
  const roleLabel = useRoleLabel();
  const business = useStore((s) => s.business);
  const businessId = useStore((s) => s.sync.businessId);
  const userId = useStore((s) => s.sync.userId);
  const [businesses, setBusinesses] = useState<Biz[]>([]);

  const load = () => {
    fetch("/api/businesses")
      .then((r) => (r.ok ? r.json() : { businesses: [] }))
      .then((d) => setBusinesses(d.businesses ?? []))
      .catch(() => {});
  };

  return (
    <Menu
      align="start"
      width={260}
      items={[
        { type: "label", label: t("Your shops", "আপনার দোকান") },
        ...businesses.map((b) => ({
          label: b.name,
          icon: <Storefront />,
          hint: b.id === businessId ? <Check className="size-4 text-brand-ink" weight="bold" /> : undefined,
          onSelect: async () => {
            if (b.id === businessId) return;
            await fetch("/api/businesses/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessId: b.id }) });
            await enterAccount(userId ?? me.id);
            router.replace("/dashboard");
          },
        })),
        { label: t("Create another shop", "আরেকটি দোকান খুলুন"), icon: <Plus />, onSelect: () => router.push("/welcome") },
        { type: "divider" },
        { label: t("Sync now", "এখনই সিঙ্ক"), icon: <ArrowsClockwise />, onSelect: () => void syncNow() },
        {
          label: t("Sign out", "সাইন আউট"),
          icon: <SignOut />,
          danger: true,
          onSelect: async () => {
            await leaveAccount();
            router.replace("/login");
          },
        },
      ]}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={() => {
            void load();
            toggle();
          }}
          className={cn("flex w-full items-center gap-2.5 rounded-md py-1.5 text-left transition-colors", collapsed ? "justify-center" : "px-2", bold ? "hover:bg-white/10" : "hover:bg-sunken")}
        >
          <Avatar name={me.name} color={me.color} size={30} className={bold ? "ring-2 ring-white/30" : ""} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{me.name}</span>
                <span className={cn("block truncate text-xs", bold ? "text-brand-contrast/70" : "text-ink-3")}>
                  {roleLabel(me.role)} · {business.name}
                </span>
              </span>
              <CaretUpDown className="size-4 opacity-60" />
            </>
          )}
        </button>
      )}
    />
  );
}

/** Demo mode banner content for the sidebar. */
export function DemoNotice({ bold }: { bold: boolean }) {
  const t = useT();
  return (
    <Link href="/login" className={cn("block rounded-md px-3 py-2.5 text-xs transition-colors", bold ? "bg-white/10 hover:bg-white/15" : "bg-cash-soft text-cash-ink hover:brightness-[0.98]")}>
      <span className="block font-semibold">{t("You're exploring a demo shop", "আপনি ডেমো দোকান দেখছেন")}</span>
      <span className="mt-0.5 block opacity-80">{t("Sign up free to keep your own shop’s data.", "নিজের দোকানের তথ্য রাখতে ফ্রি সাইন আপ করুন।")}</span>
    </Link>
  );
}
