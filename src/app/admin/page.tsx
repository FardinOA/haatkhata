"use client";

import { ArrowLeft, Buildings, ChartLineUp, Eye, MagnifyingGlass, Megaphone, ShieldWarning, Storefront, UsersThree, Wallet } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Meter } from "@/components/billing-admin/parts";
import { BarChart } from "@/components/charts";
import { Badge, Button, cn, EmptyState, Field, Input, Panel, Select, Skeleton, Textarea } from "@/components/ui/core";
import { Dialog, Sheet, useToast } from "@/components/ui/overlays";
import { useDebounced, useFmt } from "@/lib/hooks";
import { enterAccount } from "@/lib/sync";

type Overview = { tenants: number; activeThisWeek: number; trials: number; signupsThisWeek: number; plans: Record<string, number>; ordersPerWeek: { week: string; n: number }[]; mrr: number; announcements: { id: string; title: string; recipients: number; createdAt: string }[] };
type Row = { id: string; name: string; phone: string; plan: string; createdAt: string; orders30d: number; renewsAt: string | null };
type Detail = {
  business: { id: string; name: string; phone: string; address: string; plan: string; planName: string; renewsAt: string | null; trialEndsAt: string | null; createdAt: string; referralCode: string | null };
  limits: { ordersPerMonth: number; products: number | null; staff: number | null };
  usage: { orders: number; products: number; staff: number };
  prints: { used: number; limit: number } | null;
  members: { userId: string; name: string; phone: string; role: string; status: string }[];
  activity: { id: string; type: string; status: string; error: string | null; at: string }[];
  payments: { id: string; plan: string; amount: number; status: string; invoiceNo: string | null; at: string }[];
  adminActions: { id: number; action: string; reason: string | null; at: string }[];
};

const PLAN_TONE: Record<string, "brand" | "ok" | "cash" | "neutral" | "info"> = { trial: "cash", expired: "neutral", starter: "info", business: "brand", pro: "ok" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error ?? `HTTP ${r.status}`), { status: r.status });
  return d as T;
}

export default function AdminPage() {
  const f = useFmt();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [denied, setDenied] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const query = useDebounced(q, 250);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);

  const loadOverview = useCallback(() => {
    api<Overview>("/api/admin/overview")
      .then(setOverview)
      .catch((e) => setDenied((e as { status?: number }).status ?? 500));
  }, []);

  useEffect(loadOverview, [loadOverview]);
  useEffect(() => {
    let live = true;
    api<{ businesses: Row[] }>(`/api/admin/businesses?q=${encodeURIComponent(query)}`)
      .then((d) => live && setRows(d.businesses))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [query]);

  if (denied)
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <Panel className="w-full max-w-md">
          <EmptyState
            icon={<ShieldWarning />}
            title={denied === 401 ? "Sign in to continue" : "This area is for BechaKena staff only"}
            body={denied === 401 ? "Use the phone number that has admin access." : "Ask an existing admin to run `npm run admin:grant -- <your phone>`."}
            action={
              <Link href={denied === 401 ? "/login" : "/dashboard"} className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
                {denied === 401 ? "Sign in" : "Back to the app"}
              </Link>
            }
          />
        </Panel>
      </div>
    );

  const weeks = overview?.ordersPerWeek ?? [];
  // The current week is still running, so the headline compares the last two complete weeks.
  const thisWeek = weeks.at(-2)?.n ?? 0;
  const lastWeek = weeks.at(-3)?.n ?? 0;
  const runningWeek = weeks.at(-1)?.n ?? 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-4 px-4 md:px-8">
          <span className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[10px] bg-ink text-white">
              <ShieldWarning className="size-5" weight="duotone" />
            </span>
            <span className="font-display text-lg font-semibold">
              BechaKena <span className="text-ink-3">Admin</span>
            </span>
          </span>
          <Link href="/dashboard" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
            <ArrowLeft className="size-4" />
            App
          </Link>
          <Button size="sm" variant="primary" icon={<Megaphone className="size-4" />} onClick={() => setAnnouncing(true)}>
            Announce
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] space-y-6 px-4 py-6 md:px-8">
        {/* North-star first: orders processed per week across every shop. */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-ink-3">Orders processed last week</p>
                <p className="figure mt-1 text-[38px] font-semibold leading-none text-ink">{overview ? f.num(thisWeek) : "—"}</p>
                <p className={cn("mt-1 text-xs font-medium", thisWeek >= lastWeek ? "text-ok" : "text-danger")}>{overview ? `${thisWeek >= lastWeek ? "▲" : "▼"} ${f.num(Math.abs(thisWeek - lastWeek))} vs the week before · ${f.num(runningWeek)} so far this week` : ""}</p>
              </div>
              <Badge tone="brand">North-star</Badge>
            </div>
            <div className="mt-4">
              {overview ? <BarChart height={150} data={weeks.map((w, i) => ({ label: f.dateShort(w.week), value: w.n, tip: `Week of ${f.dateShort(w.week)}`, color: i === weeks.length - 1 ? undefined : "var(--brand-300)" }))} format={(n) => f.num(n)} /> : <Skeleton className="h-[150px] w-full" />}
            </div>
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Buildings, label: "Businesses", value: overview?.tenants, sub: overview ? `${f.num(overview.signupsThisWeek)} new this week` : "" },
              { icon: Storefront, label: "Active this week", value: overview?.activeThisWeek, sub: overview && overview.tenants ? `${f.pct(overview.activeThisWeek / overview.tenants)} of all` : "" },
              { icon: UsersThree, label: "On trial", value: overview?.trials, sub: "7-day Business trial" },
              { icon: Wallet, label: "MRR", value: overview ? f.money(overview.mrr) : undefined, sub: "From running paid periods" },
            ].map((m) => (
              <Panel key={m.label} className="flex flex-col justify-between p-4">
                <m.icon className="size-5 text-brand-ink" weight="duotone" />
                <div className="mt-3">
                  <p className="figure text-2xl font-semibold leading-none text-ink">{m.value === undefined ? "—" : typeof m.value === "number" ? f.num(m.value) : m.value}</p>
                  <p className="mt-1 text-[13px] font-medium text-ink-2">{m.label}</p>
                  <p className="text-xs text-ink-3">{m.sub}</p>
                </div>
              </Panel>
            ))}
          </div>
        </section>

        {overview && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink-3">Plans</span>
            {Object.entries(overview.plans).map(([p, n]) => (
              <Badge key={p} tone={PLAN_TONE[p] ?? "neutral"}>
                {p} <b className="tnum font-semibold">{f.num(n)}</b>
              </Badge>
            ))}
          </div>
        )}

        <Panel>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Businesses</h2>
            <Input className="ml-auto w-full max-w-sm" inputSize="sm" leading={<MagnifyingGlass className="size-4" />} placeholder="Name, owner phone, id or referral code" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search businesses" />
          </div>
          {!rows ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<MagnifyingGlass />} title={q ? `Nothing matches “${q}”` : "No businesses yet"} body="Try the owner's phone number or the business id." />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13.5px]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="px-5 py-2.5 font-medium">Business</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 text-right font-medium">Orders · 30 days</th>
                    <th className="px-3 py-2.5 font-medium">Renews / trial ends</th>
                    <th className="px-5 py-2.5 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-line hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <button type="button" className="text-left font-medium text-ink hover:underline" onClick={() => setOpenId(r.id)}>
                          {r.name}
                        </button>
                        <p className="tnum text-xs text-ink-3">{r.phone || r.id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={PLAN_TONE[r.plan] ?? "neutral"}>{r.plan}</Badge>
                      </td>
                      <td className="tnum px-3 py-3 text-right font-medium">{f.num(r.orders30d)}</td>
                      <td className="tnum px-3 py-3 text-ink-2">{r.renewsAt ? f.date(r.renewsAt) : "—"}</td>
                      <td className="tnum px-5 py-3 text-ink-3">{f.date(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {overview && overview.announcements.length > 0 && (
          <Panel className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Recent announcements</h2>
            <ul className="mt-3 divide-y divide-line">
              {overview.announcements.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                  <Megaphone className="size-4 text-ink-3" />
                  <span className="flex-1 truncate text-ink">{a.title}</span>
                  <span className="tnum text-xs text-ink-3">
                    {f.num(a.recipients)} shops · {f.relative(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </main>

      <BusinessSheet id={openId} onClose={() => setOpenId(null)} onChanged={loadOverview} />
      <AnnounceDialog open={announcing} onClose={() => setAnnouncing(false)} onSent={loadOverview} />
    </div>
  );
}

function BusinessSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const f = useFmt();
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [mode, setMode] = useState<"plan" | "impersonate" | "prints" | null>(null);
  const [plan, setPlan] = useState("business");
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api<Detail>(`/api/admin/businesses/${id}`)
      .then(setD)
      .catch((e) => toast({ tone: "warn", title: (e as Error).message }));
  }, [id, toast]);
  useEffect(load, [load]);

  const act = async () => {
    if (!id) return;
    setBusy(true);
    try {
      if (mode === "plan") {
        await api(`/api/admin/businesses/${id}/plan`, { method: "POST", body: JSON.stringify({ plan, days, reason }) });
        toast({ title: `Plan set to ${plan} for ${days} days` });
        load();
        onChanged();
      } else if (mode === "prints") {
        const r = await api<{ cleared: number }>(`/api/admin/businesses/${id}/prints`, { method: "POST", body: JSON.stringify({ reason }) });
        toast({ title: r.cleared ? "Trial prints given back" : "Nothing to reset — no prints counted yet" });
        load();
      } else {
        const r = await api<{ ownerUserId: string }>("/api/admin/impersonate", { method: "POST", body: JSON.stringify({ businessId: id, reason }) });
        await enterAccount(r.ownerUserId);
        router.push("/dashboard");
      }
      setMode(null);
      setReason("");
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!id} onClose={onClose} width={620} title={d?.business.name ?? "Business"} sub={d ? `${d.business.id} · joined ${f.date(d.business.createdAt)}` : undefined}>
      {!d || d.business.id !== id ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PLAN_TONE[d.business.plan] ?? "neutral"}>{d.business.planName}</Badge>
            {d.business.trialEndsAt && <span className="text-[13px] text-ink-3">Trial ends {f.date(d.business.trialEndsAt)}</span>}
            {d.business.renewsAt && <span className="text-[13px] text-ink-3">Renews {f.date(d.business.renewsAt)}</span>}
            <span className="ml-auto flex gap-2">
              <Button size="sm" icon={<ChartLineUp className="size-4" />} onClick={() => setMode("plan")}>
                Change plan
              </Button>
              <Button size="sm" variant="primary" icon={<Eye className="size-4" />} onClick={() => setMode("impersonate")}>
                Sign in as owner
              </Button>
            </span>
          </div>
          <div className={`grid gap-4 rounded-md bg-surface-2 p-4 ${d.prints ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <Meter label="Orders this month" used={d.usage.orders} limit={d.limits.ordersPerMonth} format={f.num} />
            <Meter label="Products" used={d.usage.products} limit={d.limits.products} format={f.num} />
            <Meter label="Team" used={d.usage.staff} limit={d.limits.staff} format={f.num} />
            {d.prints && (
              <div className="space-y-2">
                <Meter label="Trial prints" used={d.prints.used} limit={d.prints.limit} format={f.num} />
                {d.prints.used > 0 && (
                  <button type="button" className="text-[12.5px] font-medium text-brand-ink underline-offset-2 hover:underline" onClick={() => setMode("prints")}>
                    Give prints back
                  </button>
                )}
              </div>
            )}
          </div>
          <Section title="Members">
            {d.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                <span>
                  <span className="font-medium text-ink">{m.name || "—"}</span> <span className="tnum text-ink-3">{m.phone}</span>
                </span>
                <span className="text-xs text-ink-3">
                  {m.role.startsWith("custom:") ? "custom role" : m.role} · {m.status}
                </span>
              </li>
            ))}
          </Section>
          <Section title="Recent activity">
            {d.activity.length === 0 && <li className="py-2 text-[13px] text-ink-3">No synced changes yet.</li>}
            {d.activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                <span className={cn("font-mono text-xs", a.status === "rejected" ? "text-danger" : "text-ink-2")}>{a.type}</span>
                <span className="truncate text-xs text-ink-3">{a.error ?? ""}</span>
                <span className="tnum shrink-0 text-xs text-ink-4">{f.relative(a.at)}</span>
              </li>
            ))}
          </Section>
          <Section title="Payments">
            {d.payments.length === 0 && <li className="py-2 text-[13px] text-ink-3">No payments.</li>}
            {d.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                <span>
                  {p.plan} · {p.invoiceNo ?? p.status}
                </span>
                <span className="tnum">{f.money(p.amount)}</span>
              </li>
            ))}
          </Section>
          <Section title="Admin log">
            {d.adminActions.length === 0 && <li className="py-2 text-[13px] text-ink-3">Nothing recorded.</li>}
            {d.adminActions.map((a) => (
              <li key={a.id} className="py-1.5 text-[13px]">
                <span className="font-medium text-ink">{a.action}</span> <span className="text-ink-3">· {f.relative(a.at)}</span>
                {a.reason && <p className="text-xs text-ink-3">“{a.reason}”</p>}
              </li>
            ))}
          </Section>
        </div>
      )}
      <Dialog
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode === "plan" ? "Change plan" : mode === "prints" ? "Give trial prints back" : "Sign in as the owner"}
        tone={mode === "impersonate" ? "cash" : "brand"}
        icon={mode === "impersonate" ? <Eye weight="fill" /> : <ChartLineUp weight="fill" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={reason.trim().length < 5} onClick={act}>
              {mode === "plan" ? "Apply" : mode === "prints" ? "Give back" : "Sign in as owner"}
            </Button>
          </>
        }
      >
        <div className="mt-2 grid gap-3">
          {mode === "plan" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan" htmlFor="ov-plan">
                <Select id="ov-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {["trial", "expired", "starter", "business", "pro"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="For (days)" htmlFor="ov-days">
                <Input id="ov-days" inputMode="numeric" value={days} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 1)} />
              </Field>
            </div>
          )}
          {mode === "prints" && <p className="text-[13px] text-ink-2">Clears this shop’s counted trial prints, including the device and network counts they used, so the owner can print again. Use it when a shared network used them up — not as a discount.</p>}
          {mode === "impersonate" && <p className="text-[13px] text-ink-2">You’ll see the app exactly as the owner does. A bar stays on screen until you exit, and the reason is recorded.</p>}
          <Field label="Reason (recorded)" htmlFor="ov-reason">
            <Textarea id="ov-reason" data-autofocus rows={2} placeholder={mode === "plan" ? "e.g. Paid by bank transfer, ref 4471" : mode === "prints" ? "e.g. Shares an office IP with another seller (ticket 205)" : "e.g. Owner asked for help setting up invoices (ticket 182)"} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[13px] font-semibold text-ink">{title}</h3>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function AnnounceDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={520}
      title="Announce to every shop"
      tone="brand"
      icon={<Megaphone weight="fill" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={title.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ recipients: number }>("/api/admin/announcements", { method: "POST", body: JSON.stringify({ title, body, href }) });
                toast({ title: `Sent to ${r.recipients} shops` });
                setTitle("");
                setBody("");
                setHref("");
                onSent();
                onClose();
              } catch (e) {
                toast({ tone: "warn", title: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="mt-2 grid gap-3">
        <Field label="Title" htmlFor="an-title">
          <Input id="an-title" data-autofocus maxLength={140} placeholder="e.g. Pathao booking is back to normal" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Details" htmlFor="an-body" optional="optional">
          <Textarea id="an-body" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Link inside the app" htmlFor="an-href" optional="optional">
          <Input id="an-href" placeholder="/settings?tab=plan" value={href} onChange={(e) => setHref(e.target.value)} />
        </Field>
        <p className="text-xs text-ink-3">It appears in every shop’s notifications. Keep it short and useful.</p>
      </div>
    </Dialog>
  );
}
