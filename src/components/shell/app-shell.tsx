"use client";

import {
  Bell,
  CaretUpDown,
  CloudSlash,
  DotsThreeOutline,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  Translate,
} from "@phosphor-icons/react";
import { LazyMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BrandMark } from "../bits";
import { Avatar, Button, cn, IconButton, Kbd, Skeleton } from "../ui/core";
import { Menu, Sheet, ToastProvider } from "../ui/overlays";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { NAV, NAV_GROUPS } from "./nav";
import { AccountMenu, DemoNotice, SyncBridge, SyncStatus } from "./account";
import { ServiceWorker } from "./service-worker";
import { useFmt, useHotkey, useHydrated, useNow, useT } from "@/lib/hooks";
import { ImpersonationBar } from "../billing-admin/impersonation-bar";
import { PinLock } from "../billing-admin/pin-lock";
import { PlanBanner } from "../billing-admin/plan-banner";
import { useRoleLabel } from "../billing-admin/role-label";
import { useMe, useStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";

/* ------------------------------------------------------------ theme sync */

function ThemeSync() {
  const theme = useStore((s) => s.theme);
  const lang = useStore((s) => s.lang);
  useEffect(() => applyTheme(theme, lang), [theme, lang]);
  return null;
}

function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function useCollapsed() {
  // Shell only renders client-side (after store hydration), so reading storage here is safe.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("bk-sidebar") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("bk-sidebar", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  return [collapsed, toggle] as const;
}

const loadMotion = () => import("../motion-features").then((r) => r.default);

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/* ------------------------------------------------------------ shell */

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  return (
    <LazyMotion features={loadMotion} strict>
      <ToastProvider>{ready ? <Shell>{children}</Shell> : <ShellSkeleton />}</ToastProvider>
    </LazyMotion>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [collapsed, toggle] = useCollapsed();
  const palette = useCommandPalette();
  const router = useRouter();
  useHotkey("n", () => router.push("/pos"));

  return (
    <>
      <ThemeSync />
      <ServiceWorker />
      <SyncBridge />
      <PinLock />
      <ImpersonationBar />
      <div className="flex min-h-dvh">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onSearch={palette.show} />
          <PlanBanner />
          <main className="min-w-0 flex-1 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-10">{children}</main>
        </div>
      </div>
      <MobileTabBar />
      <CommandPalette {...palette} />
    </>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <aside className="hidden w-[248px] shrink-0 border-r border-line bg-surface p-4 md:block">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-6 h-10 w-full rounded-md" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-3/4" />
          ))}
        </div>
      </aside>
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-72 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ sidebar */

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useT();
  const f = useFmt();
  const path = usePathname();
  const style = useStore((s) => s.theme.sidebar);
  const mode = useStore((s) => s.sync.mode);
  const business = useStore((s) => s.business);
  const plan = useStore((s) => s.plan);
  const toAction = useStore((s) => s.orders.filter((o) => o.status === "confirmed" || o.status === "packed").length);
  const monthOrders = useStore((s) => {
    const now = new Date();
    return s.orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  });
  const usage = monthOrders / plan.orderLimit;

  const bold = style === "bold";
  const skin = {
    light: "bg-surface border-r border-line",
    tinted: "bg-brand-50 border-r border-brand-100",
    bold: "bg-brand text-brand-contrast",
  }[style];
  const itemIdle = bold ? "text-brand-contrast/75 hover:bg-white/12 hover:text-brand-contrast" : "text-ink-2 hover:bg-sunken hover:text-ink";
  const itemActive = bold ? "bg-white/18 text-brand-contrast" : style === "tinted" ? "bg-surface text-brand-ink shadow-1" : "bg-brand-50 text-brand-ink";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col transition-[width] duration-200 ease-[var(--ease-out)] md:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
        skin,
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 pb-3 pt-4", collapsed && "justify-center px-0")}>
        <BrandMark size={36} inverted={bold} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold leading-tight">{t.lang === "bn" ? business.nameBn || business.name : business.name}</p>
            <p className={cn("truncate text-xs", bold ? "text-brand-contrast/70" : "text-ink-3")}>{t(`${plan.name} plan`, `${plan.name} প্ল্যান`)}</p>
          </div>
        )}
      </div>

      <div className={cn("px-3", collapsed && "px-3.5")}>
        <Link
          href="/pos"
          className={cn(
            "group flex h-11 items-center gap-2.5 rounded-md font-medium transition-all",
            bold ? "bg-surface text-brand-ink hover:bg-white" : "bg-brand text-brand-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.07]",
            collapsed ? "w-12 justify-center" : "px-3.5",
          )}
          title={t("New order", "নতুন অর্ডার")}
        >
          <Plus className="size-[18px]" weight="bold" />
          {!collapsed && (
            <>
              <span className="flex-1 text-sm">{t("New order", "নতুন অর্ডার")}</span>
              <span className={cn("rounded-[5px] px-1.5 text-[11px] font-semibold", bold ? "bg-brand-50 text-brand-ink" : "bg-white/20")}>N</span>
            </>
          )}
        </Link>
      </div>

      <nav className="scroll-thin mt-4 flex-1 overflow-y-auto px-3" aria-label={t("Main", "প্রধান")}>
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="mb-4">
            {!collapsed && <p className={cn("px-3 pb-1.5 text-xs font-medium", bold ? "text-brand-contrast/55" : "text-ink-4")}>{t(g.en, g.bn)}</p>}
            {collapsed && <div className={cn("mx-auto mb-2 h-px w-6", bold ? "bg-white/20" : "bg-line")} />}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g.key).map((n) => {
                const active = isActive(path, n.href);
                const I = n.icon;
                return (
                  <li key={n.key}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? t(n.en, n.bn) : undefined}
                      className={cn(
                        "relative flex h-10 items-center gap-3 rounded-md text-[14px] font-medium transition-colors",
                        collapsed ? "justify-center" : "px-3",
                        active ? itemActive : itemIdle,
                      )}
                    >
                      <I className="size-[19px] shrink-0" weight={active ? "fill" : "regular"} />
                      {!collapsed && <span className="flex-1 truncate">{t(n.en, n.bn)}</span>}
                      {n.key === "orders" && toAction > 0 && (
                        <span
                          className={cn(
                            "tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
                            collapsed && "absolute right-1.5 top-1 h-4 min-w-4 px-1 text-[10px]",
                            bold ? "bg-surface text-brand-ink" : "bg-brand text-brand-contrast",
                          )}
                        >
                          {f.num(toAction)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("space-y-2 border-t px-3 py-3", bold ? "border-white/15" : "border-line")}>
        {NAV.filter((n) => n.group === "system").map((n) => {
          const active = isActive(path, n.href);
          const I = n.icon;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(n.en, n.bn) : undefined}
              className={cn("flex h-10 items-center gap-3 rounded-md text-[14px] font-medium transition-colors", collapsed ? "justify-center" : "px-3", active ? itemActive : itemIdle)}
            >
              <I className="size-[19px] shrink-0" weight={active ? "fill" : "regular"} />
              {!collapsed && t(n.en, n.bn)}
            </Link>
          );
        })}
        {!collapsed && (
          <Link href="/settings?tab=plan" className={cn("block rounded-md px-3 py-2.5 transition-colors", bold ? "hover:bg-white/10" : "hover:bg-sunken")}>
            <div className="flex items-baseline justify-between text-xs">
              <span className={bold ? "text-brand-contrast/80" : "text-ink-3"}>{t("Orders this month", "এই মাসের অর্ডার")}</span>
              <span className="tnum font-medium">
                {f.num(monthOrders)}/{f.compact(plan.orderLimit)}
              </span>
            </div>
            <div className={cn("mt-1.5 h-1 overflow-hidden rounded-full", bold ? "bg-white/20" : "bg-sunken")}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, usage * 100)}%`, background: usage >= 1 ? "var(--color-danger)" : usage >= 0.8 ? "var(--cash)" : bold ? "var(--brand-contrast)" : "var(--brand)" }}
              />
            </div>
          </Link>
        )}
        {mode === "account" ? (
          <>
            <SyncStatus bold={bold} compact={collapsed} />
            <AccountMenu collapsed={collapsed} bold={bold} />
          </>
        ) : (
          <>
            {!collapsed && <DemoNotice bold={bold} />}
            <UserSwitcher collapsed={collapsed} bold={bold} />
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={cn("flex h-9 w-full items-center gap-3 rounded-md text-[13px] transition-colors", collapsed ? "justify-center" : "px-3", itemIdle)}
          aria-label={collapsed ? t("Expand sidebar", "সাইডবার বড় করুন") : t("Collapse sidebar", "সাইডবার ছোট করুন")}
        >
          <SidebarSimple className="size-[18px]" />
          {!collapsed && t("Collapse", "ছোট করুন")}
        </button>
      </div>
    </aside>
  );
}

/** Demo affordance: switch staff to see role-based permissions in action. */
function UserSwitcher({ collapsed, bold }: { collapsed: boolean; bold: boolean }) {
  const t = useT();
  const roleLabel = useRoleLabel();
  const me = useMe();
  const staff = useStore((s) => s.staff);
  const switchUser = useStore((s) => s.switchUser);
  return (
    <Menu
      align="start"
      width={240}
      items={[
        { type: "label", label: t("View the app as", "যার চোখে দেখবেন") },
        ...staff.map((s) => ({
          label: (
            <span className="flex items-center gap-2">
              {s.name}
              <span className="text-xs text-ink-4">{roleLabel(s.role)}</span>
            </span>
          ),
          icon: <Avatar name={s.name} color={s.color} size={20} />,
          onSelect: () => switchUser(s.id),
          hint: s.id === me.id ? "✓" : undefined,
        })),
      ]}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={cn("flex w-full items-center gap-2.5 rounded-md py-1.5 text-left transition-colors", collapsed ? "justify-center" : "px-2", bold ? "hover:bg-white/10" : "hover:bg-sunken")}
        >
          <Avatar name={me.name} color={me.color} size={30} className={bold ? "ring-2 ring-white/30" : ""} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{me.name}</span>
                <span className={cn("block truncate text-xs", bold ? "text-brand-contrast/70" : "text-ink-3")}>{roleLabel(me.role)}</span>
              </span>
              <CaretUpDown className="size-4 opacity-60" />
            </>
          )}
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------ topbar */

function Topbar({ onSearch }: { onSearch: () => void }) {
  const t = useT();
  const online = useOnline();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const business = useStore((s) => s.business);
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 md:h-16 md:px-8">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5 md:hidden">
          <BrandMark size={30} />
          <span className="truncate font-display text-[15px] font-semibold">{lang === "bn" ? business.nameBn || business.name : business.name}</span>
        </Link>
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-10 w-full max-w-[420px] items-center gap-2.5 rounded-full border border-line bg-surface px-4 text-[13.5px] text-ink-3 shadow-1 transition-colors hover:border-line-strong hover:text-ink-2 md:flex"
        >
          <MagnifyingGlass className="size-4" />
          <span className="flex-1 text-left">{t("Search orders, products, customers…", "অর্ডার, পণ্য, কাস্টমার খুঁজুন…")}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <div className="flex items-center gap-1 md:ml-auto">
          {!online && (
            <span className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-warn-soft px-3 text-xs font-medium text-warn">
              <CloudSlash className="size-4" />
              <span className="hidden sm:inline">{t("Offline — saving on this device", "অফলাইন — এই ডিভাইসে সেভ হচ্ছে")}</span>
            </span>
          )}
          <IconButton label={t("Search", "খুঁজুন")} size="sm" onClick={onSearch} className="rounded-full md:hidden">
            <MagnifyingGlass className="size-[18px]" />
          </IconButton>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            aria-label={lang === "en" ? "Switch to Bangla" : "Switch to English"}
          >
            <Translate className="size-4" />
            {lang === "en" ? "বাংলা" : "English"}
          </button>
          <Notifications />
        </div>
      </div>
    </header>
  );
}

function Notifications() {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const notices = useStore((s) => s.notices);
  const markRead = useStore((s) => s.markNoticesRead);
  const unread = notices.filter((n) => !n.read).length;
  const KIND_COLOR = { low_stock: "var(--color-warn)", new_order: "var(--brand)", cod_overdue: "var(--cash)", plan: "var(--color-st-confirmed)", return: "var(--color-st-returned)" } as const;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
        aria-label={t(`Notifications, ${unread} unread`, `নোটিফিকেশন, ${unread}টি নতুন`)}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-danger ring-2 ring-surface" />}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("Notifications", "নোটিফিকেশন")}
        sub={unread ? t(`${unread} new`, `${f.num(unread)}টি নতুন`) : t("You're all caught up", "সব দেখা হয়েছে")}
        width={420}
        headerExtra={
          unread > 0 ? (
            <Button size="sm" variant="ghost" onClick={markRead}>
              {t("Mark all read", "সব পড়া হয়েছে")}
            </Button>
          ) : null
        }
      >
        <ul className="divide-y divide-line">
          {notices.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "#"} onClick={() => setOpen(false)} className="flex gap-3 px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.read ? "var(--line-strong)" : KIND_COLOR[n.kind] }} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", n.read ? "text-ink-2" : "font-medium text-ink")}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[13px] text-ink-3">{n.body}</span>}
                  <span className="mt-1 block text-xs text-ink-4">{f.relative(n.at, now)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------ mobile */

function MobileTabBar() {
  const t = useT();
  const mode = useStore((s) => s.sync.mode);
  const path = usePathname();
  const [more, setMore] = useState(false);
  const items = NAV.filter((n) => ["home", "orders", "products"].includes(n.key));
  const rest = NAV.filter((n) => !["home", "orders", "products"].includes(n.key));
  const tab = (n: (typeof NAV)[number]) => {
    const active = isActive(path, n.href);
    const I = n.icon;
    return (
      <Link key={n.key} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-brand-ink" : "text-ink-3")}>
        <I className="size-[22px]" weight={active ? "fill" : "regular"} />
        {t(n.en, n.bn)}
      </Link>
    );
  };
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label={t("Main", "প্রধান")}>
        <div className="flex h-16 items-stretch">
          {tab(items[0])}
          {tab(items[1])}
          <div className="flex flex-1 items-center justify-center">
            <Link href="/pos" aria-label={t("New order", "নতুন অর্ডার")} className="-mt-6 grid size-14 place-items-center rounded-full bg-brand text-brand-contrast shadow-[0_8px_20px_-6px_var(--brand),inset_0_1px_0_rgb(255_255_255/0.2)] ring-4 ring-canvas">
              <Plus className="size-6" weight="bold" />
            </Link>
          </div>
          {tab(items[2])}
          <button type="button" onClick={() => setMore(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-3">
            <DotsThreeOutline className="size-[22px]" />
            {t("More", "আরও")}
          </button>
        </div>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={t("More", "আরও")}>
        <div className="grid grid-cols-3 gap-2 p-4">
          {rest.map((n) => {
            const I = n.icon;
            return (
              <Link key={n.key} href={n.href} onClick={() => setMore(false)} className="flex flex-col items-center gap-2 rounded-lg bg-surface-2 px-2 py-4 text-center text-[13px] font-medium text-ink-2 hover:bg-sunken">
                <I className="size-6 text-brand-ink" />
                {t(n.en, n.bn)}
              </Link>
            );
          })}
        </div>
        <div className="border-t border-line p-4">
          {mode === "account" ? (
            <div className="space-y-1">
              <SyncStatus />
              <AccountMenu collapsed={false} bold={false} />
            </div>
          ) : (
            <UserSwitcher collapsed={false} bold={false} />
          )}
        </div>
      </Sheet>
    </>
  );
}

