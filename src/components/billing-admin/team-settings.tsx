"use client";

import { CheckCircle, Crown, LockKey, PencilSimple, Plus, ShieldCheck, Sparkle, Trash, UserPlus, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Checkbox, cn, Field, Input, Segmented, Select } from "../ui/core";
import { Dialog, useConfirm, useToast } from "../ui/overlays";
import { builtinPermissions, can, DEFAULT_MAX_DISCOUNT_PCT, normalizePhone, ROLES } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { useMe, useStore } from "@/lib/store";
import type { BuiltinRole, CustomRoleDef, Permission, Role } from "@/lib/types";
import { Card } from "./parts";
import { disablePin, enablePin, lockNow, setIdleMinutes, usePin, weakPin } from "./pin-client";
import { useRoleLabel } from "./role-label";
import { deleteRole, ensureRolesLoaded, saveRole, useRoles, type RoleDraft } from "./roles-client";
import { useUsage } from "./usage-client";

/** Grouped the way an owner thinks about a job, not by system area. */
const GROUPS: { en: string; bn: string; perms: { key: Permission; en: string; bn: string; hint?: string; hintBn?: string }[] }[] = [
  {
    en: "Selling",
    bn: "বিক্রি",
    perms: [
      { key: "create_order", en: "Take orders", bn: "অর্ডার নেওয়া" },
      { key: "edit_price", en: "Change prices", bn: "দাম বদলানো", hint: "On products and in a cart", hintBn: "পণ্যে ও কার্টে" },
      { key: "big_discount", en: "Any discount", bn: "যেকোনো ছাড়", hint: "Without it, the cap below applies", hintBn: "না থাকলে নিচের সীমা প্রযোজ্য" },
      { key: "delete_order", en: "Delete orders", bn: "অর্ডার মোছা" },
    ],
  },
  {
    en: "Parcels",
    bn: "পার্সেল",
    perms: [
      { key: "pack_ship", en: "Pack & ship", bn: "প্যাক ও পাঠানো" },
      { key: "deliver_return", en: "Mark delivered, take returns, collect COD", bn: "ডেলিভারি, ফেরত ও COD" },
    ],
  },
  {
    en: "Stock & money",
    bn: "স্টক ও টাকা",
    perms: [
      { key: "edit_stock", en: "Change stock", bn: "স্টক বদলানো" },
      { key: "view_cost", en: "See buying prices & profit", bn: "ক্রয়মূল্য ও লাভ দেখা" },
      { key: "reports", en: "Reports", bn: "রিপোর্ট" },
      { key: "settings", en: "Shop settings & team", bn: "দোকানের সেটিংস ও টিম" },
    ],
  },
];

const MATRIX: { key: Permission; en: string; bn: string }[] = [
  ...GROUPS.flatMap((g) => g.perms),
  { key: "billing", en: "Plan & billing", bn: "প্ল্যান ও বিলিং" },
];

export function TeamSettings() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const me = useMe();
  const staff = useStore((s) => s.staff);
  const addStaff = useStore((s) => s.addStaff);
  const updateStaff = useStore((s) => s.updateStaff);
  const removeStaff = useStore((s) => s.removeStaff);
  const mode = useStore((s) => s.sync.mode);
  const roleLabel = useRoleLabel();
  const roles = useRoles((s) => s.roles);
  const rolesAvailable = useRoles((s) => s.available);
  const { data: usage } = useUsage();
  const [confirm, confirmNode] = useConfirm();
  const [inviting, setInviting] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", role: "sales" as Role });
  const [editing, setEditing] = useState<CustomRoleDef | "new" | null>(null);
  const phone = normalizePhone(draft.phone);
  const isOwner = me.role === "owner";
  const seats = usage?.usage.staff.limit ?? null;
  const full = seats !== null && staff.length >= seats;
  const customAllowed = mode !== "account" || (rolesAvailable && !!usage?.features.includes("custom_roles"));

  useEffect(() => {
    void ensureRolesLoaded(true);
  }, [mode]);

  const roleOptions: { value: Role; label: string }[] = [...ROLES.filter((r) => r !== "owner").map((r) => ({ value: r as Role, label: roleLabel(r) })), ...roles.map((r) => ({ value: r.key as Role, label: roleLabel(r.key) }))];
  const columns: Role[] = [...ROLES, ...roles.map((r) => r.key)];

  return (
    <div className="space-y-5">
      <Card
        title={t("Team", "টিম")}
        sub={seats === null ? t(`${staff.length} people · unlimited seats`, `${f.num(staff.length)} জন · সীমাহীন আসন`) : t(`${staff.length} of ${seats} seats on the ${usage?.planName ?? ""} plan`, `${usage?.planName ?? ""} প্ল্যানে ${f.num(seats)}টির মধ্যে ${f.num(staff.length)}টি আসন`)}
        footer={
          <>
            {full && (
              <Link href="/settings?tab=plan" className="mr-auto self-center text-[13px] font-medium text-cash-ink hover:underline">
                {t("All seats used — upgrade for more", "সব আসন ব্যবহৃত — আরও পেতে আপগ্রেড করুন")}
              </Link>
            )}
            <Button variant="primary" icon={<UserPlus className="size-4" />} disabled={!isOwner || full} onClick={() => setInviting(true)}>
              {t("Invite by phone", "ফোন দিয়ে আমন্ত্রণ")}
            </Button>
          </>
        }
      >
        <ul className="-my-1 divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={s.name} color={s.color} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {s.name}
                  {s.id === me.id && <Badge tone="brand">{t("You", "আপনি")}</Badge>}
                </p>
                <p className="tnum text-[13px] text-ink-3">{f.digits(s.phone)}</p>
              </div>
              {s.role === "owner" ? (
                <Badge tone="cash">
                  <Crown className="size-3" weight="fill" />
                  {roleLabel("owner")}
                </Badge>
              ) : (
                <>
                  <Select inputSize="sm" className="w-40" value={s.role} disabled={!isOwner} onChange={(e) => updateStaff(s.id, { role: e.target.value as Role })} aria-label={t(`Role for ${s.name}`, `${s.name} এর রোল`)}>
                    {roleOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {!roleOptions.some((o) => o.value === s.role) && <option value={s.role}>{roleLabel(s.role)}</option>}
                  </Select>
                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={async () => {
                      if (await confirm({ title: t(`Remove ${s.name}?`, `${s.name} কে সরাবেন?`), body: t("They'll be signed out on every device. Their past orders stay.", "সব ডিভাইস থেকে লগ আউট হবে। আগের অর্ডার থাকবে।"), confirm: t("Remove", "সরান"), danger: true }))
                        removeStaff(s.id);
                    }}
                    className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                    aria-label={t(`Remove ${s.name}`, `${s.name} কে সরান`)}
                  >
                    <Trash className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={t("Roles", "রোল")}
        sub={t("What each person can do. Checked again on the server for every change.", "কে কী করতে পারেন। প্রতিটি পরিবর্তন সার্ভারেও যাচাই হয়।")}
        aside={
          isOwner && customAllowed ? (
            <Button size="sm" icon={<Plus className="size-4" weight="bold" />} onClick={() => setEditing("new")}>
              {t("New role", "নতুন রোল")}
            </Button>
          ) : null
        }
      >
        {!customAllowed && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md bg-brand-50 px-4 py-3">
            <Sparkle className="size-5 text-brand-ink" weight="fill" />
            <p className="min-w-0 flex-1 text-[13px] text-brand-ink">{t("Make your own roles — like “Counter staff” who can take orders and give up to 5% off — on the Pro plan.", "প্রো প্ল্যানে নিজের মতো রোল বানান — যেমন “কাউন্টার স্টাফ” যিনি অর্ডার নিতে ও ৫% পর্যন্ত ছাড় দিতে পারেন।")}</p>
            <Link href="/settings?tab=plan" className="text-[13px] font-semibold text-brand-ink hover:underline">
              {t("See Pro", "প্রো দেখুন")}
            </Link>
          </div>
        )}
        <div className="scroll-thin -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[600px] text-[13px]">
            <thead>
              <tr className="text-left align-bottom text-ink-3">
                <th className="py-2 pr-3 font-medium">{t("Permission", "অনুমতি")}</th>
                {columns.map((r) => {
                  const def = roles.find((x) => x.key === r);
                  return (
                    <th key={r} className="px-2 py-2 text-center font-medium">
                      {def ? (
                        <button type="button" disabled={!isOwner} onClick={() => setEditing(def)} className="inline-flex max-w-[110px] items-center gap-1 rounded-sm px-1.5 py-0.5 text-brand-ink hover:bg-brand-50 disabled:text-ink-3">
                          <span className="truncate">{roleLabel(r)}</span>
                          {isOwner && <PencilSimple className="size-3 shrink-0" />}
                        </button>
                      ) : (
                        roleLabel(r)
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-2.5 pr-3 text-ink-2">{t(p.en, p.bn)}</td>
                  {columns.map((r) => (
                    <td key={r} className="px-2 py-2.5 text-center">
                      {can(r, p.key) ? <CheckCircle className="mx-auto size-[18px] text-ok" weight="fill" aria-label={t("Allowed", "অনুমতি আছে")} /> : <X className="mx-auto size-3.5 text-ink-4" aria-label={t("Not allowed", "অনুমতি নেই")} />}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-2.5 pr-3 text-ink-2">{t("Discount without approval", "অনুমোদন ছাড়া ছাড়")}</td>
                {columns.map((r) => {
                  const def = roles.find((x) => x.key === r);
                  const cap = can(r, "big_discount") ? 100 : def ? def.maxDiscountPct : DEFAULT_MAX_DISCOUNT_PCT;
                  return (
                    <td key={r} className="tnum px-2 py-2.5 text-center font-medium text-ink-2">
                      {cap >= 100 ? t("Any", "যেকোনো") : f.pct(cap / 100)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-ink-3">{t("Billing always stays with the owner.", "বিলিং সবসময় মালিকের হাতে থাকে।")}</p>
      </Card>

      <PinCard />

      <Dialog
        open={inviting}
        onClose={() => setInviting(false)}
        title={t("Invite a team member", "টিমে আমন্ত্রণ")}
        tone="brand"
        icon={<UserPlus weight="fill" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviting(false)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button
              variant="primary"
              disabled={!draft.name.trim() || !phone}
              onClick={() => {
                addStaff({ name: draft.name.trim(), phone: phone!, role: draft.role });
                setInviting(false);
                setDraft({ name: "", phone: "", role: "sales" });
                toast({ title: t(`Invite sent to ${draft.name}`, `${draft.name} কে আমন্ত্রণ পাঠানো হয়েছে`), body: t("They join with a code sent by SMS.", "SMS কোড দিয়ে যোগ দেবেন।") });
              }}
            >
              {t("Send invite", "আমন্ত্রণ পাঠান")}
            </Button>
          </>
        }
      >
        <div className="mt-2 grid gap-3">
          <Field label={t("Name", "নাম")} htmlFor="inv-name">
            <Input id="inv-name" data-autofocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t("Mobile number", "মোবাইল নম্বর")} htmlFor="inv-phone" error={draft.phone && !phone ? t("Use a Bangladeshi mobile number", "বাংলাদেশি মোবাইল নম্বর দিন") : undefined}>
            <Input id="inv-phone" inputMode="tel" placeholder="017XXXXXXXX" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} aria-invalid={!!draft.phone && !phone} />
          </Field>
          <Field label={t("Role", "রোল")} htmlFor="inv-role">
            <Select id="inv-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>

      {editing && <RoleEditor role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {confirmNode}
    </div>
  );
}

/* ------------------------------------------------------------ role editor */

function RoleEditor({ role, onClose }: { role: CustomRoleDef | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const roleLabel = useRoleLabel();
  const [confirm, confirmNode] = useConfirm();
  const [d, setD] = useState<RoleDraft>(() => (role ? { name: role.name, nameBn: role.nameBn, permissions: [...role.permissions], maxDiscountPct: role.maxDiscountPct } : { name: "", nameBn: "", permissions: ["create_order"], maxDiscountPct: 5 }));
  const [busy, setBusy] = useState(false);
  const toggle = (p: Permission) => setD({ ...d, permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p] });
  const start = (r: BuiltinRole) => setD({ ...d, permissions: builtinPermissions(r).filter((p) => p !== "billing"), maxDiscountPct: can(r, "big_discount") ? 100 : DEFAULT_MAX_DISCOUNT_PCT });
  const unlimited = d.permissions.includes("big_discount");

  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      title={role ? t(`Edit “${role.name}”`, `“${role.nameBn || role.name}” বদলান`) : t("New role", "নতুন রোল")}
      tone="brand"
      icon={<ShieldCheck weight="fill" />}
      footer={
        <>
          {role && (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
              icon={<Trash className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: t(`Delete “${role.name}”?`, `“${role.name}” মুছবেন?`), body: t("People need another role before this one can go.", "মোছার আগে সবাইকে অন্য রোল দিন।"), confirm: t("Delete", "মুছুন"), danger: true }))) return;
                try {
                  await deleteRole(role.id);
                  toast({ title: t("Role deleted", "রোল মুছে ফেলা হয়েছে") });
                  onClose();
                } catch (e) {
                  toast({ tone: "warn", title: (e as Error).message });
                }
              }}
            >
              {t("Delete", "মুছুন")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel", "বাতিল")}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={d.name.trim().length < 2 || d.permissions.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await saveRole({ ...d, name: d.name.trim(), nameBn: d.nameBn?.trim() || undefined }, role?.id);
                toast({ title: role ? t("Role updated", "রোল আপডেট হয়েছে") : t(`“${d.name}” is ready to assign`, `“${d.name}” রোল তৈরি হয়েছে`) });
                onClose();
              } catch (e) {
                toast({ tone: "warn", title: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            {role ? t("Save role", "রোল সেভ") : t("Create role", "রোল তৈরি")}
          </Button>
        </>
      }
    >
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label={t("Role name", "রোলের নাম")} htmlFor="role-name">
          <Input id="role-name" data-autofocus placeholder={t("e.g. Counter staff", "যেমন: কাউন্টার স্টাফ")} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label={t("Name in Bangla", "বাংলায় নাম")} htmlFor="role-namebn" optional={t("optional", "ঐচ্ছিক")}>
          <Input id="role-namebn" lang="bn" value={d.nameBn ?? ""} onChange={(e) => setD({ ...d, nameBn: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Start from", "শুরু করুন")}</p>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.filter((r) => r !== "owner").map((r) => (
            <button key={r} type="button" onClick={() => start(r)} className="h-8 rounded-full border border-line px-3 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand-ink">
              {roleLabel(r)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {GROUPS.map((g) => (
          <fieldset key={g.en}>
            <legend className="mb-1.5 text-xs font-medium text-ink-4">{t(g.en, g.bn)}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {g.perms.map((p) => {
                const on = d.permissions.includes(p.key);
                return (
                  <label key={p.key} className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors", on ? "border-brand-200 bg-brand-50" : "border-line hover:border-line-strong")}>
                    <Checkbox checked={on} onChange={() => toggle(p.key)} label={t(p.en, p.bn)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{t(p.en, p.bn)}</span>
                      {p.hint && <span className="block text-xs text-ink-3">{t(p.hint, p.hintBn ?? p.hint)}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className={cn("mt-5 rounded-md bg-surface-2 px-4 py-3", unlimited && "opacity-50")}>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="role-disc" className="text-[13px] font-medium text-ink-2">
            {t("Biggest discount on their own", "নিজে সর্বোচ্চ কত ছাড়")}
          </label>
          <span className="tnum text-sm font-semibold text-ink">{unlimited ? t("Any", "যেকোনো") : `${d.maxDiscountPct}%`}</span>
        </div>
        <input id="role-disc" type="range" min={0} max={50} step={1} disabled={unlimited} value={d.maxDiscountPct} onChange={(e) => setD({ ...d, maxDiscountPct: Number(e.target.value) })} className="mt-2 w-full accent-[var(--brand)]" />
      </div>
      {confirmNode}
    </Dialog>
  );
}

/* ------------------------------------------------------------ device PIN */

function PinCard() {
  const t = useT();
  const toast = useToast();
  const enabled = usePin((s) => s.enabled);
  const idle = usePin((s) => s.idleMinutes);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = again.length === 4 && pin !== again;
  const weak = pin.length === 4 && weakPin(pin);

  return (
    <Card
      title={t("Quick unlock on this device", "এই ডিভাইসে দ্রুত আনলক")}
      sub={t("For shared counter phones and tablets: the app locks when nobody's using it, and opens with a 4-digit PIN.", "দোকানের শেয়ার করা ফোন বা ট্যাবের জন্য: কেউ ব্যবহার না করলে অ্যাপ লক হয়, ৪ সংখ্যার পিনে খোলে।")}
      aside={<LockKey className={cn("size-6", enabled ? "text-ok" : "text-ink-4")} weight="duotone" />}
    >
      {enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="ok">{t("PIN is on", "পিন চালু")}</Badge>
          <span className="text-[13px] text-ink-3">{t("Lock after", "লক হবে")}</span>
          <Segmented<string>
            size="sm"
            value={String(idle)}
            onChange={(v) => setIdleMinutes(Number(v))}
            options={[1, 5, 15, 30].map((m) => ({ value: String(m), label: t(`${m} min`, `${m} মিনিট`) }))}
            ariaLabel={t("Lock after", "লক হবে")}
          />
          <span className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => lockNow()}>
              {t("Lock now", "এখনই লক")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await disablePin();
                toast({ title: t("PIN turned off on this device", "এই ডিভাইসে পিন বন্ধ") });
              }}
            >
              {t("Turn off", "বন্ধ করুন")}
            </Button>
          </span>
        </div>
      ) : (
        <Button icon={<LockKey className="size-4" />} onClick={() => setOpen(true)}>
          {t("Set a PIN", "পিন দিন")}
        </Button>
      )}
      <p className="mt-3 text-xs text-ink-3">{t("Five wrong tries sign this device out — the full phone code is needed again. Nothing saved on the device is lost.", "পাঁচবার ভুল হলে ডিভাইস সাইন আউট হবে — আবার ফোন কোড লাগবে। ডিভাইসে সেভ করা কিছু হারাবে না।")}</p>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Choose a 4-digit PIN", "৪ সংখ্যার পিন বাছুন")}
        tone="brand"
        icon={<LockKey weight="fill" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={pin.length !== 4 || again !== pin || weak}
              onClick={async () => {
                setBusy(true);
                try {
                  await enablePin(pin);
                  toast({ title: t("PIN set for this device", "এই ডিভাইসে পিন সেট হয়েছে") });
                  setOpen(false);
                  setPin("");
                  setAgain("");
                } catch (e) {
                  toast({ tone: "warn", title: (e as Error).message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("Turn on", "চালু করুন")}
            </Button>
          </>
        }
      >
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field label={t("PIN", "পিন")} htmlFor="pin1" error={weak ? t("Too easy to guess", "খুব সহজ") : undefined}>
            <Input id="pin1" data-autofocus type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="tnum text-center text-lg tracking-[0.5em]" />
          </Field>
          <Field label={t("Once more", "আবার দিন")} htmlFor="pin2" error={mismatch ? t("Doesn't match", "মেলেনি") : undefined}>
            <Input id="pin2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))} className="tnum text-center text-lg tracking-[0.5em]" />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
