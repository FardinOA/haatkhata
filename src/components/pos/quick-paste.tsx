"use client";

import { ChatCircleText, Check, MapPin, Phone, Sparkle, User } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { api, type AiParsed } from "@/components/platform/api";
import { getVariant, useStore } from "@/lib/store";
import { usePos } from "./use-pos";
import { Button, cn, Textarea } from "@/components/ui/core";
import { Dialog } from "@/components/ui/overlays";
import { formatPhone } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { parseMessage, type ParsedMessage } from "./parse-message";

const SAMPLE = "Assalamu alaikum apu\nনাম: ফারহানা চৌধুরী\n০১৮১৫-৪৪৩৩২২\nবাসা ১৪, রোড ৩, মিরপুর ১০, ঢাকা\n2ta kurti M size, indigo";

/** Paste a Messenger chat, see what was understood, confirm to fill the order. */
export function QuickPaste({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (p: ParsedMessage) => void }) {
  const t = useT();
  const f = useFmt();
  const [text, setText] = useState("");
  const rules = useMemo(() => parseMessage(text), [text]);
  // AI reading (account mode): better names/addresses and matched cart items.
  const accountMode = useStore((s) => s.sync.mode === "account");
  const products = useStore((s) => s.products);
  const { addVariant } = usePos();
  const [ai, setAi] = useState<{ text: string; result: AiParsed } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const aiNow = ai && ai.text === text ? ai.result : null;
  const parsed: ParsedMessage = aiNow
    ? {
        name: aiNow.name ?? rules.name,
        phone: aiNow.phone ?? rules.phone,
        address: aiNow.address || aiNow.area || aiNow.district ? { line: aiNow.address ?? "", area: aiNow.area ?? "", district: aiNow.district ?? rules.address?.district ?? "Dhaka" } : rules.address,
        leftover: aiNow.notes ?? rules.leftover,
        found: { name: !!(aiNow.name ?? rules.name), phone: !!(aiNow.phone ?? rules.phone), address: !!(aiNow.address || aiNow.area || rules.found.address) },
      }
    : rules;
  const any = parsed.found.name || parsed.found.phone || parsed.found.address || !!aiNow?.items.some((i) => i.variantId);
  const readWithAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await api<AiParsed>("/api/ai/parse-order", { method: "POST", json: { text } });
      setAi({ text, result });
      setPicked(Object.fromEntries(result.items.map((i, k) => [k, !!i.variantId])));
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const row = (icon: React.ReactNode, label: string, value: React.ReactNode, ok: boolean) => (
    <div className={cn("flex items-start gap-3 rounded-md px-3 py-2.5", ok ? "bg-ok-soft/60" : "bg-sunken/70")}>
      <span className={cn("mt-0.5 [&>svg]:size-4", ok ? "text-ok" : "text-ink-4")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-3">{label}</span>
        <span className={cn("block truncate text-sm", ok ? "font-medium text-ink" : "text-ink-4")}>{ok ? value : t("Not found", "পাওয়া যায়নি")}</span>
      </span>
      {ok && <Check className="mt-1 size-4 text-ok" weight="bold" />}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={560}
      tone="brand"
      icon={<ChatCircleText weight="fill" />}
      title={t("Paste the customer's message", "কাস্টমারের মেসেজ পেস্ট করুন")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button
            variant="primary"
            disabled={!any}
            onClick={() => {
              onApply(parsed);
              aiNow?.items.forEach((i, k) => i.variantId && picked[k] && addVariant(i.variantId, i.qty));
              setText("");
              setAi(null);
              onClose();
            }}
          >
            {t("Use these details", "এই তথ্য ব্যবহার করুন")}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-3">{t("We'll pick out the name, phone and address — Bangla, Banglish or English.", "নাম, ফোন আর ঠিকানা আমরা খুঁজে নেব — বাংলা, বাংলিশ বা ইংরেজি।")}</p>
      <Textarea
        data-autofocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={SAMPLE}
        className="mt-3 font-[inherit]"
        aria-label={t("Message", "মেসেজ")}
      />
      {!text && (
        <button type="button" onClick={() => setText(SAMPLE)} className="mt-2 text-[13px] font-medium text-brand-ink hover:underline">
          {t("Try a sample message", "একটি নমুনা মেসেজ দেখুন")}
        </button>
      )}
      {text && accountMode && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={aiNow ? "ghost" : "soft"} loading={aiBusy} icon={<Sparkle className="size-4" weight="fill" />} onClick={readWithAi} disabled={text.trim().length < 3}>
            {aiNow ? t("Read again", "আবার পড়ুন") : t("Read with AI — items too", "AI দিয়ে পড়ুন — পণ্যসহ")}
          </Button>
          {aiNow && (
            <span className="text-xs text-ink-3">
              {aiNow.source === "ai" ? t(`AI · ${Math.round(aiNow.confidence * 100)}% sure`, `AI · ${f.num(Math.round(aiNow.confidence * 100))}% নিশ্চিত`) : t("AI unavailable — used the quick reader", "AI পাওয়া যায়নি — দ্রুত পাঠক ব্যবহার হয়েছে")}
              {" · "}
              {t(`${aiNow.usage.limit - aiNow.usage.used} reads left this month`, `এই মাসে আর ${f.num(aiNow.usage.limit - aiNow.usage.used)} বার`)}
            </span>
          )}
          {aiError && <span className="text-xs text-danger">{aiError}</span>}
        </div>
      )}
      {text && (
        <div className="mt-4 grid gap-2">
          {row(<User />, t("Name", "নাম"), parsed.name, parsed.found.name)}
          {row(<Phone />, t("Phone", "ফোন"), parsed.phone && f.digits(formatPhone(parsed.phone)), parsed.found.phone)}
          {row(
            <MapPin />,
            t("Address", "ঠিকানা"),
            parsed.address && [parsed.address.line, parsed.address.area, parsed.address.district].filter(Boolean).join(", "),
            parsed.found.address,
          )}
          {aiNow && aiNow.items.length > 0 && (
            <div className="rounded-md border border-line bg-surface-2 p-2">
              <p className="px-1 pb-1.5 text-xs font-medium text-ink-3">{t("Items they asked for", "যে পণ্য চেয়েছেন")}</p>
              {aiNow.items.map((it, k) => {
                const hit = it.variantId ? getVariant(products, it.variantId) : null;
                return (
                  <label key={k} className={cn("flex items-center gap-2.5 rounded-sm px-1.5 py-1.5", hit ? "cursor-pointer hover:bg-surface" : "opacity-70")}>
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" disabled={!hit} checked={!!picked[k]} onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.checked }))} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{hit ? `${hit.p.name}${Object.values(hit.v.options).length ? ` · ${Object.values(hit.v.options).join(" / ")}` : ""}` : it.text}</span>
                      <span className="block truncate text-xs text-ink-3">{hit ? `“${it.text}”` : t("No matching product — add it by hand", "মেলেনি — হাতে যোগ করুন")}</span>
                    </span>
                    <span className="tnum text-sm font-semibold text-ink">×{f.num(it.qty)}</span>
                  </label>
                );
              })}
            </div>
          )}
          {parsed.leftover && (
            <p className="px-1 pt-1 text-xs text-ink-3">
              {t("Also in the message:", "মেসেজে আরও আছে:")} <span className="text-ink-2">{parsed.leftover}</span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
