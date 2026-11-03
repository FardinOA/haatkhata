"use client";

import { Bluetooth, CircleNotch } from "@phosphor-icons/react";
import { toCanvas } from "html-to-image";
import { useState } from "react";
import { Button } from "../ui/core";
import { useToast } from "../ui/overlays";
import { chunk, EscPos, PAPER_DOTS, toMonochrome } from "@/lib/escpos";
import { useT } from "@/lib/hooks";

// Common BLE printer services (generic 18F0, Xprinter/Goojprt, ISSC transparent UART).
const SERVICES = ["000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "0000ff00-0000-1000-8000-00805f9b34fb"];

type Writable = { writeValueWithoutResponse?: (v: BufferSource) => Promise<void>; writeValue: (v: BufferSource) => Promise<void>; properties: { write: boolean; writeWithoutResponse: boolean } };
type BluetoothLike = { requestDevice: (o: unknown) => Promise<{ name?: string; gatt?: { connected: boolean; connect: () => Promise<{ getPrimaryServices: () => Promise<{ getCharacteristics: () => Promise<Writable[]> }[]> }> } }> };

let cached: { name: string; ch: Writable } | null = null;

async function connect(): Promise<{ name: string; ch: Writable }> {
  const bt = (navigator as unknown as { bluetooth?: BluetoothLike }).bluetooth;
  if (!bt) throw new Error("unsupported");
  const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  const server = await device.gatt!.connect();
  for (const svc of await server.getPrimaryServices())
    for (const ch of await svc.getCharacteristics()) if (ch.properties.write || ch.properties.writeWithoutResponse) return (cached = { name: device.name ?? "Printer", ch });
  throw new Error("This device doesn't accept print data");
}

async function send(ch: Writable, data: Uint8Array) {
  for (const part of chunk(data, 180)) {
    const buf = part.slice().buffer as ArrayBuffer;
    if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(buf);
    else await ch.writeValue(buf);
    await new Promise((r) => setTimeout(r, 12));
  }
}

/** Renders the on-screen receipt(s) to 1-bit raster and prints over Bluetooth; falls back to the print dialog. */
export function ThermalPrintButton({ getElements, paper, onPrinted, beforePrint }: { getElements: () => HTMLElement[]; paper: "thermal58" | "thermal80"; onPrinted?: () => void; beforePrint?: () => Promise<boolean> }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const supported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  const print = async () => {
    if (beforePrint && !(await beforePrint())) return;
    if (!supported) {
      toast({ tone: "info", title: t("Bluetooth printing needs Chrome on Android or a computer", "ব্লুটুথ প্রিন্ট Android বা কম্পিউটারের Chrome-এ চলে"), body: t("Opening the normal print dialog instead.", "সাধারণ প্রিন্ট ডায়ালগ খুলছি।") });
      window.print();
      return;
    }
    setBusy(true);
    try {
      const printer = cached ?? (await connect());
      const dots = PAPER_DOTS[paper];
      const job = new EscPos().init();
      for (const el of getElements()) {
        const canvas = await toCanvas(el, { backgroundColor: "#ffffff", pixelRatio: dots / el.offsetWidth, cacheBust: true });
        const ctx = canvas.getContext("2d")!;
        const w = Math.min(dots, canvas.width);
        const { data } = ctx.getImageData(0, 0, w, canvas.height);
        job.align("center").raster(toMonochrome(data, w, canvas.height), w).cut();
      }
      await send(printer.ch, job.build());
      onPrinted?.();
      toast({ title: t(`Sent to ${printer.name}`, `${printer.name}-এ পাঠানো হয়েছে`) });
    } catch (e) {
      cached = null;
      const msg = (e as Error).message;
      if (!/cancel/i.test(msg)) toast({ tone: "warn", title: t("Couldn't reach the printer", "প্রিন্টারে পৌঁছানো যায়নি"), body: t("Turn the printer on, keep it close, and try again.", "প্রিন্টার চালু করে কাছে রাখুন, আবার চেষ্টা করুন।") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" icon={busy ? <CircleNotch className="size-4 animate-spin" /> : <Bluetooth className="size-4" />} onClick={print} disabled={busy} title={cached ? cached.name : undefined}>
      <span className="hidden sm:inline">{t("Print to thermal", "থার্মালে প্রিন্ট")}</span>
    </Button>
  );
}
