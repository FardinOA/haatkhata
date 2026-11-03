"use client";

import { Check, Layout, Plus, SlidersHorizontal } from "@phosphor-icons/react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { StaticGrid } from "@/components/dashboard/static-grid";
import { WIDGETS } from "@/components/dashboard/widgets";
import { Badge, Button, cn, Segmented } from "@/components/ui/core";
import { Menu, Sheet, useToast } from "@/components/ui/overlays";
import type { Range } from "@/lib/analytics";
import { useT } from "@/lib/hooks";
import { DASH_PRESETS, useStore, WIDGET_SIZES } from "@/lib/store";
import type { WidgetType } from "@/lib/types";

// Drag-and-drop only matters while customising, so it stays out of the first load.
const EditableGrid = dynamic(() => import("@/components/dashboard/dashboard-grid").then((m) => m.DashboardGrid), {
  ssr: false,
  loading: () => <StaticGrid />,
});

export default function DashboardPage() {
  const t = useT();
  const toast = useToast();
  const range = useStore((s) => s.dashboard.range);
  const setRange = useStore((s) => s.setDashRange);
  const layout = useStore((s) => s.dashboard.layout);
  const preset = useStore((s) => s.dashboard.preset);
  const applyPreset = useStore((s) => s.applyDashPreset);
  const addWidget = useStore((s) => s.addWidget);
  const [editing, setEditing] = useState(false);
  const [library, setLibrary] = useState(false);
  const onBoard = new Set(layout.map((w) => w.type));

  const presetMenu = (
    <Menu
      width={280}
      items={[
        { type: "label", label: t("Start from a layout", "একটি লেআউট বেছে নিন") },
        ...Object.entries(DASH_PRESETS).map(([key, p]) => ({
          label: (
            <span className="block">
              <span className="block font-medium">{t(p.name, p.nameBn)}</span>
              <span className="block text-xs text-ink-3">{p.note}</span>
            </span>
          ),
          hint: preset === key ? "✓" : undefined,
          onSelect: () => {
            applyPreset(key);
            toast({ title: t(`Switched to “${p.name}”`, `“${p.nameBn}” লেআউট চালু হলো`) });
          },
        })),
      ]}
      trigger={({ toggle, ref }) => (
        <Button ref={ref} size="sm" icon={<Layout className="size-4" />} onClick={toggle}>
          {t("Layouts", "লেআউট")}
        </Button>
      )}
    />
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-5 md:px-8 md:pt-7">
      {/* Toolbar: range + customise. Becomes the edit bar while customising. */}
      <div className={cn("sticky top-14 z-20 -mx-4 mb-5 px-4 py-2 transition-colors md:top-16 md:-mx-8 md:px-8", editing && "border-b border-brand-100 bg-brand-50/95 backdrop-blur")}>
        <>
          {editing ? (
            <div key="edit" className="bk-swap flex flex-wrap items-center gap-2">
              <p className="mr-auto text-[13.5px] text-brand-ink">
                <b className="font-semibold">{t("Customising", "সাজাচ্ছেন")}</b> — {t("drag a card by its name, pick a size, or remove it.", "নাম ধরে টেনে সরান, আকার বাছুন বা সরিয়ে ফেলুন।")}
              </p>
              {presetMenu}
              <Button size="sm" icon={<Plus className="size-4" weight="bold" />} onClick={() => setLibrary(true)}>
                {t("Add widget", "উইজেট যোগ")}
              </Button>
              <Button size="sm" variant="primary" icon={<Check className="size-4" weight="bold" />} onClick={() => setEditing(false)}>
                {t("Done", "সম্পন্ন")}
              </Button>
            </div>
          ) : (
            <div key="view" className="bk-swap flex flex-wrap items-center justify-between gap-2">
              <Segmented<Range>
                ariaLabel={t("Date range", "সময়")}
                value={range}
                onChange={setRange}
                options={[
                  { value: "today", label: t("Today", "আজ") },
                  { value: "7d", label: t("7 days", "৭ দিন") },
                  { value: "30d", label: t("30 days", "৩০ দিন") },
                ]}
              />
              <Button size="sm" variant="ghost" icon={<SlidersHorizontal className="size-4" />} onClick={() => setEditing(true)}>
                {t("Customise", "সাজান")}
              </Button>
            </div>
          )}
        </>
      </div>

      {editing ? <EditableGrid range={range} /> : <StaticGrid range={range} />}

      {editing && (
        <button
          type="button"
          onClick={() => setLibrary(true)}
          className="mt-[var(--gap)] flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-sm font-medium text-ink-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-ink"
        >
          <Plus className="size-5" weight="bold" />
          {t("Add a widget", "উইজেট যোগ করুন")}
        </button>
      )}

      <Sheet open={library} onClose={() => setLibrary(false)} title={t("Widget library", "উইজেট লাইব্রেরি")} sub={t("Pick what you want to see when you open the app.", "অ্যাপ খুললে যা দেখতে চান তা বাছুন।")} width={480}>
        <ul className="divide-y divide-line">
          {(Object.keys(WIDGETS) as WidgetType[]).map((type) => {
            const def = WIDGETS[type];
            const I = def.icon;
            const added = onBoard.has(type);
            return (
              <li key={type} className="flex items-center gap-3.5 px-5 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-ink">
                  <I className="size-5" weight="duotone" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t(def.en, def.bn)}</span>
                  <span className="block text-[13px] text-ink-3">{t(def.note, def.noteBn)}</span>
                  <span className="mt-1 flex gap-1">
                    {WIDGET_SIZES[type].map((s) => (
                      <Badge key={s} className="h-[18px] px-1.5 text-[10.5px]">
                        {s.toUpperCase()}
                      </Badge>
                    ))}
                  </span>
                </span>
                {added ? (
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ok">
                    <Check className="size-4" weight="bold" />
                    {t("Added", "যোগ হয়েছে")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      addWidget(type);
                      toast({ title: t(`${def.en} added to the bottom`, `${def.bn} নিচে যোগ হলো`) });
                    }}
                  >
                    {t("Add", "যোগ")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
