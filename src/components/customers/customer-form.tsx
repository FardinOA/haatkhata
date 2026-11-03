"use client";

import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { CHANNELS, normalizePhone } from "@/lib/domain";
import { DHAKA_AREAS, DISTRICTS } from "@/lib/geo";
import { useT } from "@/lib/hooks";
import { CHANNEL_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { Channel, Customer } from "@/lib/types";

export function CustomerForm({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer; onSaved?: (id: string) => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} width={500} title={customer ? t("Edit customer", "কাস্টমার এডিট") : t("Add a customer", "কাস্টমার যোগ করুন")} sub={t("Saved customers auto-fill when you type their phone in a new order.", "নতুন অর্ডারে ফোন নম্বর দিলেই তথ্য নিজে বসে যাবে।")}>
      {open && <FormBody key={customer?.id ?? "new"} customer={customer} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function FormBody({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved?: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const customers = useStore((s) => s.customers);
  const upsert = useStore((s) => s.upsertCustomer);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [alt, setAlt] = useState(customer?.altPhone ?? "");
  const [line, setLine] = useState(customer?.address.line ?? "");
  const [area, setArea] = useState(customer?.address.area ?? "");
  const [district, setDistrict] = useState(customer?.address.district ?? "Dhaka");
  const [channel, setChannel] = useState<Channel>(customer?.channel ?? "facebook");
  const [tags, setTags] = useState(customer?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [fb, setFb] = useState(customer?.fbLink ?? "");
  const [touched, setTouched] = useState(false);

  const norm = normalizePhone(phone);
  const altNorm = alt.trim() ? normalizePhone(alt) : null;
  const dupe = norm ? customers.find((c) => c.phone === norm && c.id !== customer?.id) : undefined;
  const errors = {
    name: !name.trim() ? t("Enter a name", "নাম লিখুন") : null,
    phone: !norm ? t("Enter a Bangladeshi mobile number, like 01712-345678", "বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01712-345678") : dupe ? t(`Already saved as ${dupe.name}`, `${dupe.name} নামে আগেই সেভ করা আছে`) : null,
    alt: alt.trim() && !altNorm ? t("This number doesn't look right", "নম্বরটি সঠিক মনে হচ্ছে না") : null,
  };
  const valid = !errors.name && !errors.phone && !errors.alt;

  const save = () => {
    setTouched(true);
    if (!valid || !norm) return;
    const id = upsert({
      id: customer?.id,
      name: name.trim(),
      phone: norm,
      altPhone: altNorm ?? undefined,
      address: { line: line.trim(), area: area.trim(), district },
      channel,
      tags: tags
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      fbLink: fb.trim() || undefined,
    });
    toast({ title: customer ? t("Customer saved", "কাস্টমার সেভ হয়েছে") : t(`${name.trim()} added`, `${name.trim()} যোগ হয়েছে`) });
    onSaved?.(id);
    onClose();
  };

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label={t("Name", "নাম")} error={touched && errors.name} className="sm:col-span-2" htmlFor="cf-name">
          <Input id="cf-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!errors.name} autoComplete="off" />
        </Field>
        <Field label={t("Mobile number", "মোবাইল নম্বর")} error={(touched || phone.length >= 11) && errors.phone} htmlFor="cf-phone">
          <Input id="cf-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" aria-invalid={(touched || phone.length >= 11) && !!errors.phone} />
        </Field>
        <Field label={t("Second number", "আরেকটি নম্বর")} optional={t("optional", "ঐচ্ছিক")} error={errors.alt} htmlFor="cf-alt">
          <Input id="cf-alt" inputMode="tel" value={alt} onChange={(e) => setAlt(e.target.value)} aria-invalid={!!errors.alt} />
        </Field>
        <Field label={t("House, road, flat", "বাসা, রোড, ফ্ল্যাট")} className="sm:col-span-2" htmlFor="cf-line">
          <Input id="cf-line" value={line} onChange={(e) => setLine(e.target.value)} placeholder={t("House 12, Road 5", "বাসা ১২, রোড ৫")} />
        </Field>
        <Field label={t("Area / thana", "এলাকা / থানা")} htmlFor="cf-area">
          <Input id="cf-area" list="cf-areas" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Mirpur 10" />
          <datalist id="cf-areas">
            {DHAKA_AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label={t("District", "জেলা")} htmlFor="cf-district">
          <Select id="cf-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
            {DISTRICTS.map(([en, bn]) => (
              <option key={en} value={en}>
                {t.lang === "bn" ? bn : en}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Usually orders via", "সাধারণত অর্ডার করেন")} htmlFor="cf-channel">
          <Select id="cf-channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t.pick(CHANNEL_LABEL[c])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Facebook profile", "ফেসবুক প্রোফাইল")} optional={t("optional", "ঐচ্ছিক")} htmlFor="cf-fb">
          <Input id="cf-fb" value={fb} onChange={(e) => setFb(e.target.value)} placeholder="fb.com/…" />
        </Field>
        <Field label={t("Tags", "ট্যাগ")} hint={t("Separate with commas: regular, wholesale", "কমা দিয়ে আলাদা করুন: regular, wholesale")} className="sm:col-span-2" htmlFor="cf-tags">
          <Input id="cf-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label={t("Notes for your team", "টিমের জন্য নোট")} optional={t("optional", "ঐচ্ছিক")} className="sm:col-span-2" htmlFor="cf-notes">
          <Textarea id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Prefers evening delivery, size M", "সন্ধ্যায় ডেলিভারি পছন্দ, সাইজ M")} />
        </Field>
      </div>
      <div className="sticky bottom-0 mt-auto flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          {t("Cancel", "বাতিল")}
        </Button>
        <Button type="submit" variant="primary">
          {customer ? t("Save changes", "সেভ করুন") : t("Add customer", "কাস্টমার যোগ করুন")}
        </Button>
      </div>
    </form>
  );
}
