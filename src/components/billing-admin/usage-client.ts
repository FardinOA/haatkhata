"use client";
/**
 * Plan & usage for the current business. Account mode reads the server
 * (the source of truth); the demo derives the same shape from local data.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { effectivePlan, type Feature, type Plan, type Term, type UsageLevel } from "@/server/billing/plans";

export type Meter = { used: number; limit: number | null; level: UsageLevel };
export type Usage = {
  plan: string;
  effective: Plan["id"];
  planName: string;
  features: Feature[];
  trial: { endsAt?: string; daysLeft: number } | null;
  renewsAt: string | null;
  daysLeft: number | null;
  usage: { orders: Meter; products: Meter; staff: Meter };
  referral: { code: string | null; credits: number; referredBy: boolean };
  vatPct: number;
  payments: { id: string; plan: string; term: Term; months: number; creditMonths: number; amount: number; vatAmount: number; status: string; method: string; invoiceNo: string | null; createdAt: string; paidAt: string | null; periodEnd: string | null }[];
  methods: { method: string; gateway: string }[];
  canPay: boolean;
  demo?: boolean;
};

const level = (used: number, limit: number | null): UsageLevel => (limit === null ? "ok" : used >= limit ? "full" : used >= limit * 0.8 ? "warn" : "ok");

function demoUsage(): Usage {
  const s = useStore.getState();
  const plan = effectivePlan("business");
  const now = new Date();
  const orders = s.orders.filter((o) => {
    const d = new Date(o.createdAt);
    return o.status !== "draft" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lim = (n: number) => (Number.isFinite(n) ? n : null);
  const daysLeft = s.plan.renewsAt ? Math.ceil((new Date(s.plan.renewsAt).getTime() - now.getTime()) / 86_400_000) : 19;
  return {
    plan: "business",
    effective: "business",
    planName: plan.name,
    features: plan.features,
    trial: null,
    renewsAt: s.plan.renewsAt || null,
    daysLeft,
    usage: {
      orders: { used: orders, limit: lim(plan.limits.ordersPerMonth), level: level(orders, lim(plan.limits.ordersPerMonth)) },
      products: { used: s.products.length, limit: null, level: "ok" },
      staff: { used: s.staff.length, limit: lim(plan.limits.staff), level: level(s.staff.length, lim(plan.limits.staff)) },
    },
    referral: { code: "BKDEMO1", credits: 0, referredBy: false },
    vatPct: 5,
    payments: [],
    methods: [],
    canPay: false,
    demo: true,
  };
}

export function useUsage() {
  const mode = useStore((s) => s.sync.mode);
  const businessId = useStore((s) => s.sync.businessId);
  const orderCount = useStore((s) => s.orders.length);
  const staffCount = useStore((s) => s.staff.length);
  const [remote, setRemote] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (mode !== "account") return;
    let live = true;
    fetch("/api/billing/usage")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load your plan");
        if (live) {
          setRemote(d);
          setError(null);
        }
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [mode, businessId, orderCount, staffCount, tick]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demo = useMemo(() => (mode === "account" ? null : demoUsage()), [mode, orderCount, staffCount]);
  return { data: mode === "account" ? remote : demo, error, reload };
}
