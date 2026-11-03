"use client";

import { Desktop, DeviceMobile, ShieldCheck, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsCard } from "./sections";
import { Badge, Button, EmptyState, Skeleton } from "../ui/core";
import { useConfirm, useToast } from "../ui/overlays";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type SessionRow = { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean };
type AuditRow = { id: number; userName: string | null; action: string; entity: string; entityId: string | null; before: unknown; after: unknown; at: string };

function describeDevice(ua: string | null) {
  const s = ua ?? "";
  const os = /Android/i.test(s) ? "Android" : /iPhone|iPad/i.test(s) ? "iPhone" : /Mac OS/i.test(s) ? "Mac" : /Windows/i.test(s) ? "Windows" : /Linux/i.test(s) ? "Linux" : "Device";
  const browser = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : /Firefox\//.test(s) ? "Firefox" : "Browser";
  return { label: `${browser} on ${os}`, mobile: /Android|iPhone|Mobile/i.test(s) };
}

function SignedOutHint() {
  const t = useT();
  return (
    <EmptyState
      icon={<ShieldCheck />}
      title={t("Sign in to manage devices", "ডিভাইস দেখতে সাইন ইন করুন")}
      body={t("You're using the demo on this device only.", "আপনি শুধু এই ডিভাইসে ডেমো ব্যবহার করছেন।")}
      action={
        <Link href="/login" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
          {t("Sign in", "সাইন ইন")}
        </Link>
      }
    />
  );
}

/** Devices signed in to this account, with remote sign-out (FR-AUTH-07). */
export function DevicesSettings() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const toast = useToast();
  const mode = useStore((s) => s.sync.mode);
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [confirm, node] = useConfirm();

  const load = useCallback(() => {
    fetch("/api/auth/sessions")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setRows(d.sessions))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => {
    if (mode === "account") load();
  }, [mode, load]);

  if (mode !== "account")
    return (
      <SettingsCard title={t("Signed-in devices", "সাইন ইন করা ডিভাইস")}>
        <SignedOutHint />
      </SettingsCard>
    );

  return (
    <SettingsCard title={t("Signed-in devices", "সাইন ইন করা ডিভাইস")} sub={t("Lost a phone, or a staff member left? Sign that device out here.", "ফোন হারালে বা কেউ চলে গেলে এখান থেকে সেই ডিভাইস সাইন আউট করুন।")}>
      {!rows ? (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="-my-1 divide-y divide-line">
          {rows.map((s) => {
            const d = describeDevice(s.userAgent);
            const I = d.mobile ? DeviceMobile : Desktop;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span className="grid size-10 place-items-center rounded-md bg-sunken text-ink-2">
                  <I className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {d.label}
                    {s.current && <Badge tone="ok">{t("This device", "এই ডিভাইস")}</Badge>}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {t("Active", "সক্রিয়")} {f.relative(s.lastSeenAt, nowMs)} · {t("signed in", "সাইন ইন")} {f.dateShort(s.createdAt)}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<SignOut className="size-4" />}
                    onClick={async () => {
                      if (!(await confirm({ title: t(`Sign out ${d.label}?`, `${d.label} সাইন আউট করবেন?`), body: t("Anything not yet synced on that device stays there until someone signs in again.", "ওই ডিভাইসে সিঙ্ক না হওয়া কাজ আবার সাইন ইন না করা পর্যন্ত সেখানেই থাকবে।"), confirm: t("Sign out", "সাইন আউট"), danger: true }))) return;
                      await fetch(`/api/auth/sessions/${s.id}`, { method: "DELETE" });
                      toast({ title: t("Device signed out", "ডিভাইস সাইন আউট হয়েছে") });
                      load();
                    }}
                  >
                    {t("Sign out", "সাইন আউট")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {node}
    </SettingsCard>
  );
}

const ACTION_LABEL: Record<string, [string, string]> = {
  "product.saved": ["Changed a price or added a product", "দাম বদল বা নতুন পণ্য"],
  "product.deleted": ["Deleted a product", "পণ্য মুছেছেন"],
  "stock.adjusted": ["Adjusted stock", "স্টক সমন্বয়"],
  "staff.invited": ["Invited a team member", "টিমে আমন্ত্রণ"],
  "staff.role_changed": ["Changed a role", "ভূমিকা বদল"],
  "staff.removed": ["Removed a team member", "টিম থেকে সরানো"],
  "expense.deleted": ["Deleted an expense", "খরচ মুছেছেন"],
  "order.draft_deleted": ["Deleted a draft order", "খসড়া অর্ডার মুছেছেন"],
  "order.returned": ["Recorded a return", "ফেরত নিয়েছেন"],
  "supplier.paid": ["Paid a supplier", "সাপ্লায়ারকে টাকা দিয়েছেন"],
};

function summarize(e: AuditRow) {
  const a = (e.after ?? {}) as Record<string, unknown>;
  const b = (e.before ?? {}) as Record<string, unknown>;
  if (e.action === "stock.adjusted") return `${b.onHand ?? "?"} → ${a.onHand ?? "?"}${a.note ? ` · ${a.note}` : ""}`;
  if (e.action === "product.saved" && Array.isArray(a.priceChanges) && a.priceChanges.length)
    return (a.priceChanges as { from?: number; to: number }[]).map((c) => `৳${c.from ?? "—"} → ৳${c.to}`).join(", ");
  if (e.action === "product.saved") return String(a.name ?? "");
  if (e.action === "staff.role_changed") return `${(b as { role?: string }).role ?? "?"} → ${(a as { role?: string }).role ?? "?"}`;
  return e.entityId ?? "";
}

/** Sensitive actions for the owner (FR-AUD-01). */
export function AuditSettings() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow();
  const mode = useStore((s) => s.sync.mode);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "account") return;
    fetch("/api/audit")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRows(d.entries);
      })
      .catch((e) => setError((e as Error).message));
  }, [mode]);

  return (
    <SettingsCard title={t("Activity log", "কার্যকলাপের লগ")} sub={t("Price changes, stock adjustments, deletions and role changes — who did what, and when.", "দাম বদল, স্টক সমন্বয়, মুছে ফেলা ও ভূমিকা বদল — কে কখন কী করেছেন।")}>
      {mode !== "account" ? (
        <SignedOutHint />
      ) : error ? (
        <p className="text-sm text-ink-3">{error}</p>
      ) : !rows ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title={t("Nothing sensitive has happened yet", "এখনো সংবেদনশীল কিছু হয়নি")} body={t("Price edits, stock adjustments and deletions will appear here.", "দাম বদল, স্টক সমন্বয় ও মুছে ফেলা এখানে দেখাবে।")} />
      ) : (
        <ol className="-my-1 divide-y divide-line">
          {rows.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-4 py-3">
              <p className="text-sm text-ink">
                <b className="font-semibold">{e.userName ?? t("Someone", "কেউ")}</b> · {t(...(ACTION_LABEL[e.action] ?? [e.action, e.action]))}
              </p>
              <time className="text-xs text-ink-4" dateTime={e.at} title={`${f.date(e.at)} ${f.time(e.at)}`}>
                {f.relative(e.at, nowMs)}
              </time>
              {summarize(e) && <p className="tnum col-span-2 mt-0.5 truncate text-[13px] text-ink-3">{summarize(e)}</p>}
            </li>
          ))}
        </ol>
      )}
    </SettingsCard>
  );
}
