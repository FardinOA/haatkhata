"use client";

import {
  ArrowLeft,
  ChatCircleDots,
  Check,
  CheckCircle,
  Clock,
  FacebookLogo,
  InstagramLogo,
  Lightning,
  PaperPlaneRight,
  Plus,
  ShoppingBagOpen,
  Sparkle,
  Tag,
  WarningCircle,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Money, PageHeader, ProductThumb, RiskLabel, RiskRing, StatusPill } from "../bits";
import { api, type AiParsed } from "../platform/api";
import { ChannelsSettings } from "../platform/channels-settings";
import { Avatar, Button, cn, EmptyState, Input, Segmented, Skeleton, Textarea } from "../ui/core";
import { Menu, Sheet, useToast } from "../ui/overlays";
import { customerStats, formatPhone, orderTotals, riskLevel } from "@/lib/domain";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

type Platform = "messenger" | "instagram" | "whatsapp";
type Conversation = { id: string; accountId: string; platform: Platform; name: string; phone: string | null; customerId: string | null; lastText: string; lastMessageAt: string; lastInboundAt: string | null; unread: number; status: "open" | "done" };
type Message = { id: string; direction: "in" | "out"; text: string; attachments: { type: string; title?: string; price?: number }[]; status: string; error?: string | null; byName?: string | null; at: string };
type Reply = { id: string; title: string; text: string };
type Account = { id: string; platform: Platform; name: string; connected: boolean };

const WINDOW_MS = 24 * 3_600_000;

const PLATFORM: Record<Platform, { icon: Icon; color: string; en: string; bn: string; channel: Channel }> = {
  messenger: { icon: FacebookLogo, color: "#1877F2", en: "Messenger", bn: "মেসেঞ্জার", channel: "facebook" },
  instagram: { icon: InstagramLogo, color: "#D62976", en: "Instagram", bn: "ইনস্টাগ্রাম", channel: "instagram" },
  whatsapp: { icon: WhatsappLogo, color: "#1FA855", en: "WhatsApp", bn: "হোয়াটসঅ্যাপ", channel: "whatsapp" },
};

function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  const P = PLATFORM[platform];
  const I = P.icon;
  return (
    <span className={cn("grid size-5 place-items-center rounded-full ring-2 ring-surface", className)} style={{ background: P.color }}>
      <I className="size-3 text-white" weight="fill" />
    </span>
  );
}

/** Hours left in Meta's 24-hour reply window, or null when it's closed. */
function hoursLeft(lastInboundAt: string | null, now: number) {
  if (!lastInboundAt) return null;
  const left = WINDOW_MS - (now - new Date(lastInboundAt).getTime());
  return left > 0 ? left / 3_600_000 : null;
}

export function InboxScreen() {
  const t = useT();
  const mode = useStore((s) => s.sync.mode);
  if (mode !== "account")
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        <PageHeader title={t("Inbox", "ইনবক্স")} sub={t("Messenger, Instagram and WhatsApp in one place.", "মেসেঞ্জার, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ এক জায়গায়।")} />
        <div className="mt-6 rounded-lg border border-line bg-surface">
          <EmptyState
            icon={<ChatCircleDots />}
            title={t("The inbox needs your shop account", "ইনবক্সের জন্য দোকানের অ্যাকাউন্ট লাগবে")}
            body={t("Connect your Facebook Page, Instagram and WhatsApp after signing in. Chats then arrive here and turn into orders in a tap.", "সাইন ইন করে ফেসবুক পেজ, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ যুক্ত করুন। চ্যাট এখানে আসবে আর এক ট্যাপে অর্ডার হবে।")}
            action={
              <Link href="/login" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
                {t("Sign in", "সাইন ইন")}
              </Link>
            }
          />
        </div>
      </div>
    );
  return <Inbox />;
}

function Inbox() {
  const t = useT();
  const f = useFmt();
  const now = useNow(30_000);
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [selected, setSelected] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([api<{ conversations: Conversation[] }>("/api/inbox/conversations"), api<{ accounts: Account[] }>("/api/inbox/accounts")]);
      setConvs(c.conversations);
      setAccounts(a.accounts);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
      setConvs([]);
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    const run = () => alive && void load();
    run();
    const id = setInterval(run, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [load]);

  const shown = (convs ?? []).filter((c) => filter === "all" || c.status === filter);
  const unreadTotal = (convs ?? []).reduce((s, c) => s + c.unread, 0);
  const current = convs?.find((c) => c.id === selected) ?? null;
  const sandbox = accounts.filter((a) => !a.connected);

  return (
    <div className="mx-auto flex h-[calc(100dvh-56px-88px)] max-w-[1440px] flex-col px-4 pb-4 pt-5 md:h-[calc(100dvh-64px)] md:px-8 md:pb-6 md:pt-6">
      <PageHeader
        className={cn(selected && "max-md:hidden")}
        title={t("Inbox", "ইনবক্স")}
        sub={unreadTotal ? t(`${unreadTotal} unread across your channels`, `${f.num(unreadTotal)}টি না-পড়া মেসেজ`) : t("Messenger, Instagram and WhatsApp in one place.", "মেসেঞ্জার, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ এক জায়গায়।")}
        actions={
          <>
            {sandbox.length > 0 && (
              <Button size="sm" variant="ghost" icon={<Lightning className="size-4" />} onClick={() => setSimOpen(true)}>
                {t("Send a test message", "টেস্ট মেসেজ")}
              </Button>
            )}
            <Button size="sm" icon={<Plus className="size-4" weight="bold" />} onClick={() => setChannelsOpen(true)}>
              {t("Channels", "চ্যানেল")}
            </Button>
          </>
        }
      />

      <div className="mt-4 grid min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface shadow-1 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* list */}
        <aside className={cn("flex min-h-0 flex-col border-line md:border-r", selected && "max-md:hidden")}>
          <div className="border-b border-line p-3">
            <Segmented
              size="sm"
              className="w-full"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: t("Open", "খোলা") },
                { value: "done", label: t("Done", "শেষ") },
                { value: "all", label: t("All", "সব") },
              ]}
            />
          </div>
          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {convs === null &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="size-10 rounded-full" />
                  <span className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </span>
                </li>
              ))}
            {convs?.length === 0 && (
              <li>
                <EmptyState
                  icon={<ChatCircleDots />}
                  title={accounts.length ? t("No chats yet", "এখনো কোনো চ্যাট নেই") : t("Connect a channel to start", "শুরু করতে একটি চ্যানেল যুক্ত করুন")}
                  body={accounts.length ? t("New messages from customers land here.", "কাস্টমারের নতুন মেসেজ এখানে আসবে।") : t("Link your Facebook Page, Instagram or WhatsApp number.", "ফেসবুক পেজ, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ নম্বর যুক্ত করুন।")}
                  action={
                    accounts.length ? (
                      sandbox.length ? (
                        <Button size="sm" variant="soft" onClick={() => setSimOpen(true)}>
                          {t("Send a test message", "টেস্ট মেসেজ পাঠান")}
                        </Button>
                      ) : null
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => setChannelsOpen(true)}>
                        {t("Connect a channel", "চ্যানেল যুক্ত করুন")}
                      </Button>
                    )
                  }
                />
              </li>
            )}
            {convs && convs.length > 0 && shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">{filter === "open" ? t("Everything's answered.", "সবার উত্তর দেওয়া হয়েছে।") : t("Nothing here.", "কিছু নেই।")}</li>}
            {shown.map((c) => {
              const left = hoursLeft(c.lastInboundAt, now);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c.id);
                      setConvs((xs) => xs?.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)) ?? xs);
                    }}
                    className={cn("flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left transition-colors", selected === c.id ? "bg-brand-50" : "hover:bg-surface-2")}
                  >
                    <span className="relative shrink-0">
                      <Avatar name={c.name || "Customer"} size={40} />
                      <PlatformMark platform={c.platform} className="absolute -bottom-0.5 -right-0.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unread ? "font-semibold text-ink" : "font-medium text-ink")}>{c.name || (c.phone ? f.digits(formatPhone(c.phone)) : t("Customer", "কাস্টমার"))}</span>
                        <span className="shrink-0 text-[11px] text-ink-4">{f.relative(c.lastMessageAt, now)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "text-ink-2" : "text-ink-3")}>{c.lastText}</span>
                        {c.unread > 0 && <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-contrast">{f.num(c.unread)}</span>}
                      </span>
                      {c.status === "open" && left !== null && left < 3 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warn">
                          <Clock className="size-3" weight="bold" />
                          {t(`${Math.max(1, Math.round(left * 60))} min left to reply`, `উত্তর দিতে ${f.num(Math.max(1, Math.round(left * 60)))} মিনিট বাকি`)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* thread */}
        {current ? (
          <Thread key={current.id} conv={current} onBack={() => setSelected(null)} onChanged={load} />
        ) : (
          <div className="hidden min-h-0 flex-col items-center justify-center p-10 text-center md:flex">
            <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-ink">
              <ChatCircleDots className="size-7" weight="duotone" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-ink">{t("Pick a conversation", "একটি কথোপকথন বাছুন")}</p>
            <p className="mt-1 max-w-xs text-sm text-ink-3">{t("Reply, send product cards, and turn the chat into an order without retyping a thing.", "উত্তর দিন, পণ্যের কার্ড পাঠান, আর কিছু না লিখেই চ্যাটকে অর্ডার বানান।")}</p>
          </div>
        )}
        {current ? <CustomerPanel conv={current} onChanged={load} /> : <div className="hidden xl:block" />}
      </div>

      <Sheet open={channelsOpen} onClose={() => setChannelsOpen(false)} title={t("Channels", "চ্যানেল")} sub={t("Where customer messages come from.", "কাস্টমারের মেসেজ কোথা থেকে আসে।")} width={560}>
        <div className="p-5">
          <ChannelsSettings onChanged={load} />
        </div>
      </Sheet>
      <Simulate open={simOpen} onClose={() => setSimOpen(false)} accounts={sandbox} onSent={load} />
    </div>
  );
}

/* ------------------------------------------------------------ thread */

function Thread({ conv, onBack, onChanged }: { conv: Conversation; onBack: () => void; onChanged: () => void }) {
  const t = useT();
  const f = useFmt();
  const now = useNow(30_000);
  const toast = useToast();
  const products = useStore((s) => s.products);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [text, setText] = useState("");
  const [cards, setCards] = useState<{ type: string; title: string; price: number }[]>([]);
  const [sending, setSending] = useState(false);
  const [productPicker, setProductPicker] = useState(false);
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const left = hoursLeft(conv.lastInboundAt, now);
  const open = left !== null;

  const load = useCallback(async () => {
    const r = await api<{ messages: Message[] }>(`/api/inbox/conversations/${conv.id}`);
    setMsgs(r.messages);
  }, [conv.id]);

  useEffect(() => {
    let alive = true;
    const run = () => alive && void load().catch(() => {});
    run();
    api<{ replies: Reply[] }>("/api/inbox/saved-replies").then((r) => alive && setReplies(r.replies)).catch(() => {});
    const id = setInterval(run, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs?.length]);

  const send = async () => {
    const body = [text.trim(), ...cards.map((c) => `${c.title} — ৳${c.price}`)].filter(Boolean).join("\n");
    if (!body) return;
    setSending(true);
    try {
      const r = await api<{ status: string; error?: string; sandbox: boolean }>(`/api/inbox/conversations/${conv.id}`, { method: "POST", json: { text: body, attachments: cards } });
      if (r.status === "failed") toast({ tone: "warn", title: t("Meta didn't accept the message", "মেটা মেসেজটি নেয়নি"), body: r.error });
      setText("");
      setCards([]);
      await load();
      onChanged();
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => p.status === "active" && (!s || p.name.toLowerCase().includes(s) || (p.nameBn ?? "").includes(s) || p.variants.some((v) => v.sku.toLowerCase().includes(s)))).slice(0, 12);
  }, [products, q]);

  const P = PLATFORM[conv.platform];

  return (
    <section className={cn("flex min-h-0 flex-col", "max-md:fixed max-md:inset-0 max-md:z-40 max-md:bg-surface")} aria-label={t("Conversation", "কথোপকথন")}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onBack} className="-ml-1 grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken md:hidden" aria-label={t("Back", "পেছনে")}>
          <ArrowLeft className="size-5" />
        </button>
        <span className="relative">
          <Avatar name={conv.name || "Customer"} size={36} />
          <PlatformMark platform={conv.platform} className="absolute -bottom-0.5 -right-0.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{conv.name || t("Customer", "কাস্টমার")}</p>
          <p className="truncate text-xs text-ink-3">
            {t.lang === "bn" ? P.bn : P.en}
            {conv.phone && ` · ${f.digits(formatPhone(conv.phone))}`}
          </p>
        </div>
        <Button
          size="sm"
          variant={conv.status === "done" ? "secondary" : "ghost"}
          icon={conv.status === "done" ? <ChatCircleDots className="size-4" /> : <CheckCircle className="size-4" />}
          onClick={async () => {
            await api(`/api/inbox/conversations/${conv.id}`, { method: "PATCH", json: { status: conv.status === "done" ? "open" : "done" } });
            onChanged();
          }}
        >
          {conv.status === "done" ? t("Reopen", "আবার খুলুন") : t("Mark done", "শেষ")}
        </Button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-2/60 px-4 py-4">
        {msgs === null && <Skeleton className="mx-auto h-20 w-2/3 rounded-lg" />}
        {msgs?.map((m, i) => {
          const prev = msgs[i - 1];
          const showTime = !prev || new Date(m.at).getTime() - new Date(prev.at).getTime() > 30 * 60_000;
          return (
            <div key={m.id}>
              {showTime && <p className="py-2 text-center text-[11px] text-ink-4">{`${f.dateShort(m.at)}, ${f.time(m.at)}`}</p>}
              <div className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-[18px] px-3.5 py-2 text-[14px] leading-relaxed shadow-1", m.direction === "out" ? "rounded-br-[6px] bg-brand text-brand-contrast" : "rounded-bl-[6px] border border-line bg-surface text-ink")}>
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  {m.attachments
                    .filter((a) => a.type === "product")
                    .map((a, k) => (
                      <span key={k} className={cn("mt-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs", m.direction === "out" ? "bg-white/15" : "bg-sunken")}>
                        <Tag className="size-3.5" />
                        {a.title} · ৳{a.price}
                      </span>
                    ))}
                  {m.direction === "out" && (
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10.5px] opacity-75">
                      {m.byName && <span>{m.byName} ·</span>}
                      {m.status === "failed" ? <WarningCircle className="size-3" weight="fill" /> : <Check className="size-3" weight="bold" />}
                      {m.status === "failed" ? t("Not sent", "যায়নি") : t("Sent", "পাঠানো")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {open ? (
        <div className="border-t border-line bg-surface p-3">
          {left! < 3 && (
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warn">
              <Clock className="size-3.5" weight="bold" />
              {t(`Reply within ${Math.max(1, Math.round(left! * 60))} minutes — after that Meta closes the window.`, `${f.num(Math.max(1, Math.round(left! * 60)))} মিনিটের মধ্যে উত্তর দিন — পরে মেটা আর পাঠাতে দেবে না।`)}
            </p>
          )}
          {cards.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {cards.map((c, i) => (
                <button key={i} type="button" onClick={() => setCards((xs) => xs.filter((_, k) => k !== i))} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 text-xs font-medium text-brand-ink" title={t("Remove", "সরান")}>
                  <Tag className="size-3.5" />
                  {c.title} · ৳{c.price} ×
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Menu
              align="start"
              width={300}
              items={[
                { type: "label", label: t("Saved replies", "সংরক্ষিত উত্তর") },
                ...replies.map((r) => ({ label: r.title, hint: undefined, onSelect: () => setText((x) => (x ? `${x}\n${r.text}` : r.text)) })),
                ...(replies.length ? [{ type: "divider" as const }] : []),
                {
                  label: t("Save this message as a reply", "এই মেসেজ সংরক্ষণ করুন"),
                  icon: <Plus />,
                  disabled: !text.trim(),
                  onSelect: async () => {
                    const title = text.trim().split("\n")[0].slice(0, 40);
                    await api("/api/inbox/saved-replies", { method: "POST", json: { title, text: text.trim() } });
                    setReplies((await api<{ replies: Reply[] }>("/api/inbox/saved-replies")).replies);
                    toast({ title: t("Saved reply added", "উত্তর সংরক্ষিত হয়েছে") });
                  },
                },
              ]}
              trigger={({ toggle, ref }) => (
                <button ref={ref} type="button" onClick={toggle} className="grid size-10 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label={t("Saved replies", "সংরক্ষিত উত্তর")} title={t("Saved replies", "সংরক্ষিত উত্তর")}>
                  <Lightning className="size-5" />
                </button>
              )}
            />
            <button type="button" onClick={() => setProductPicker(true)} className="grid size-10 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label={t("Send a product", "পণ্য পাঠান")} title={t("Send a product", "পণ্য পাঠান")}>
              <ShoppingBagOpen className="size-5" />
            </button>
            <Textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={t("Write a reply…", "উত্তর লিখুন…")}
              className="max-h-36 min-h-10 flex-1 resize-none py-2"
              aria-label={t("Reply", "উত্তর")}
            />
            <Button variant="primary" className="shrink-0" loading={sending} disabled={!text.trim() && !cards.length} onClick={send} aria-label={t("Send", "পাঠান")}>
              <PaperPlaneRight className="size-4" weight="fill" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 border-t border-line bg-warn-soft/70 px-4 py-3 text-[13px] text-warn">
          <Clock className="mt-0.5 size-4 shrink-0" weight="bold" />
          <p>
            {conv.platform === "whatsapp"
              ? t("It's been more than 24 hours since this customer wrote. WhatsApp only allows approved template messages now — or wait for them to reply.", "কাস্টমার ২৪ ঘণ্টার বেশি আগে লিখেছেন। এখন শুধু অনুমোদিত টেমপ্লেট পাঠানো যায় — অথবা তাদের উত্তরের অপেক্ষা করুন।")
              : t("It's been more than 24 hours since this customer wrote, so Meta won't deliver a reply. It opens again when they message you.", "কাস্টমার ২৪ ঘণ্টার বেশি আগে লিখেছেন, তাই মেটা উত্তর পাঠাবে না। তারা আবার লিখলে খুলবে।")}
          </p>
        </div>
      )}

      <Sheet open={productPicker} onClose={() => setProductPicker(false)} title={t("Send a product", "পণ্য পাঠান")} sub={t("Adds name and price to your reply.", "উত্তরে নাম ও দাম যোগ হবে।")} width={440}>
        <div className="p-4">
          <Input autoFocus placeholder={t("Search products or SKU", "পণ্য বা SKU খুঁজুন")} value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-3 space-y-1">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    const price = p.variants[0]?.price ?? 0;
                    setCards((xs) => [...xs, { type: "product", title: t.lang === "bn" ? p.nameBn ?? p.name : p.name, price }]);
                    setProductPicker(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2"
                >
                  <ProductThumb product={p} size={40} rounded="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.lang === "bn" ? p.nameBn ?? p.name : p.name}</span>
                    <span className="block text-xs text-ink-3">{p.variants.length} {t("variants", "ভ্যারিয়েন্ট")}</span>
                  </span>
                  <Money value={p.variants[0]?.price ?? 0} className="text-sm font-semibold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </section>
  );
}

/* ------------------------------------------------------------ customer panel */

function CustomerPanel({ conv, onChanged }: { conv: Conversation; onChanged: () => void }) {
  const t = useT();
  const f = useFmt();
  const router = useRouter();
  const toast = useToast();
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const upsertCustomer = useStore((s) => s.upsertCustomer);
  const parkCart = useStore((s) => s.parkCart);
  const products = useStore((s) => s.products);
  const [phone, setPhone] = useState(conv.phone ?? "");
  const [busy, setBusy] = useState(false);
  const customer = customers.find((c) => c.id === conv.customerId) ?? (conv.phone ? customers.find((c) => c.phone === conv.phone) : undefined);
  const stats = customer ? customerStats(customer, orders) : null;
  const recent = customer ? orders.filter((o) => o.customerId === customer.id).slice(-3).reverse() : [];

  const createOrder = async () => {
    setBusy(true);
    try {
      const r = await api<{ messages: Message[] }>(`/api/inbox/conversations/${conv.id}`);
      const chat = r.messages.filter((m) => m.direction === "in").slice(-12).map((m) => m.text).join("\n");
      const parsed = chat.trim().length >= 3 ? await api<AiParsed>("/api/ai/parse-order", { method: "POST", json: { text: chat } }) : null;
      const custPhone = parsed?.phone ?? customer?.phone ?? conv.phone ?? "";
      const name = parsed?.name ?? customer?.name ?? conv.name ?? "";
      const address = parsed && (parsed.address || parsed.area || parsed.district) ? { line: parsed.address ?? "", area: parsed.area ?? "", district: parsed.district ?? "Dhaka" } : customer?.address;
      const lines = (parsed?.items ?? []).flatMap((i) => {
        if (!i.variantId) return [];
        const p = products.find((x) => x.variants.some((v) => v.id === i.variantId));
        const v = p?.variants.find((x) => x.id === i.variantId);
        return p && v ? [{ key: `${v.id}-${Math.random().toString(36).slice(2, 6)}`, productId: p.id, variantId: v.id, qty: i.qty, price: v.price, discount: 0 }] : [];
      });
      if (custPhone && !customer && name) upsertCustomer({ name, phone: custPhone, address, channel: PLATFORM[conv.platform].channel });
      parkCart({ label: `${t("Chat", "চ্যাট")} · ${name || t("Customer", "কাস্টমার")}`, lines, customer: custPhone ? { name, phone: custPhone, address } : null, channel: PLATFORM[conv.platform].channel });
      toast({ title: t("Order started from the chat", "চ্যাট থেকে অর্ডার শুরু হয়েছে"), body: t(`${lines.length} item(s) found. It's waiting as a parked cart on New order.`, `${f.num(lines.length)}টি পণ্য পাওয়া গেছে। নতুন অর্ডারে পার্ক করা কার্ট হিসেবে আছে।`) });
      router.push("/pos");
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-line xl:flex">
      <div className="space-y-4 p-4">
        <Button variant="primary" className="w-full" loading={busy} icon={<Sparkle className="size-4" weight="fill" />} onClick={createOrder}>
          {t("Create order from this chat", "এই চ্যাট থেকে অর্ডার")}
        </Button>
        {customer && stats ? (
          <div className="rounded-lg border border-line p-3.5">
            <div className="flex items-center gap-3">
              <RiskRing level={riskLevel(customer, stats)} delivered={stats.delivered} returned={stats.returned} size={44} />
              <div className="min-w-0">
                <Link href={`/customers?id=${customer.id}`} className="block truncate text-sm font-semibold text-ink hover:underline">
                  {customer.name}
                </Link>
                <RiskLabel level={riskLevel(customer, stats)} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                [t("Orders", "অর্ডার"), f.num(stats.orders)],
                [t("Returned", "ফেরত"), f.pct(stats.returnRate)],
                [t("Spent", "খরচ"), f.compact(stats.spent)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-surface-2 py-2">
                  <dt className="text-[11px] text-ink-3">{k}</dt>
                  <dd className="tnum text-sm font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {stats.due > 0 && <p className="mt-2 rounded-md bg-cash-soft px-2.5 py-1.5 text-xs font-medium text-cash-ink">{t(`Owes ${f.money(stats.due)}`, `বাকি ${f.money(stats.due)}`)}</p>}
            {recent.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders?id=${o.id}`} className="flex items-center justify-between gap-2 rounded-sm px-1 py-1 text-xs hover:bg-surface-2">
                      <span className="tnum text-ink-2">#{f.digits(String(o.no))}</span>
                      <StatusPill status={o.status} size="sm" />
                      <Money value={orderTotals(o).total} className="font-medium" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line-strong p-3.5">
            <p className="text-sm font-medium text-ink">{t("Not matched to a customer yet", "এখনো কাস্টমারের সাথে মেলেনি")}</p>
            <p className="mt-0.5 text-xs text-ink-3">{t("Add their phone to see order history and return risk.", "অর্ডার ইতিহাস ও ফেরতের ঝুঁকি দেখতে ফোন যোগ করুন।")}</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const match = customers.find((c) => c.phone === phone.replace(/\D/g, "").replace(/^88/, ""));
                await api(`/api/inbox/conversations/${conv.id}`, { method: "PATCH", json: { phone: phone.trim() || null, customerId: match?.id ?? null } });
                onChanged();
              }}
            >
              <Input inputSize="sm" inputMode="tel" placeholder="017XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button size="sm" type="submit">
                {t("Save", "সেভ")}
              </Button>
            </form>
          </div>
        )}
        <p className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
          <Clock className="mt-0.5 size-3.5 shrink-0" />
          {t("Meta lets shops reply for 24 hours after the customer's last message.", "কাস্টমারের শেষ মেসেজের পর ২৪ ঘণ্টা পর্যন্ত উত্তর দেওয়া যায়।")}
        </p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------ sandbox */

function Simulate({ open, onClose, accounts, onSent }: { open: boolean; onClose: () => void; accounts: Account[]; onSent: () => void }) {
  const t = useT();
  const toast = useToast();
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("Farhana Chowdhury");
  const [phone, setPhone] = useState("01815443322");
  const [text, setText] = useState("Apu ei kurti ta M size e ache? 2ta lagbe. Mirpur 10, Dhaka. 01815-443322");
  const acc = accounts.find((a) => a.id === accountId) ?? accounts[0];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Send a test message", "টেস্ট মেসেজ পাঠান")}
      sub={t("Pretend to be a customer on a sandbox channel.", "স্যান্ডবক্স চ্যানেলে কাস্টমার হয়ে লিখুন।")}
      width={460}
      footer={
        <Button
          variant="primary"
          className="ml-auto"
          disabled={!acc || !text.trim()}
          onClick={async () => {
            try {
              await api("/api/inbox/simulate", { method: "POST", json: { accountId: acc!.id, from, phone, text } });
              onSent();
              onClose();
            } catch (e) {
              toast({ tone: "warn", title: (e as Error).message });
            }
          }}
        >
          {t("Deliver message", "মেসেজ পাঠান")}
        </Button>
      }
    >
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium", (acc?.id ?? "") === a.id ? "border-brand bg-brand-50" : "border-line")}>
              <PlatformMark platform={a.platform} />
              {a.name}
            </button>
          ))}
        </div>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("Customer name", "কাস্টমারের নাম")} />
        {acc?.platform === "whatsapp" && <Input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t("Phone", "ফোন")} />}
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label={t("Message", "মেসেজ")} />
      </div>
    </Sheet>
  );
}
