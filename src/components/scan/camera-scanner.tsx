"use client";

import { Camera, CheckCircle, Flashlight, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, cn, IconButton } from "@/components/ui/core";
import { Sheet } from "@/components/ui/overlays";
import { makeT, useT } from "@/lib/hooks";

/** What the screen did with a scanned code — shown in the scanner's log. */
export type ScanOutcome = { ok: boolean; title: string; detail?: string };
export type ScanLogEntry = ScanOutcome & { id: number };
/** Answers a scan right away (this device) or later (a paired computer). */
export type ScanHandler = (code: string) => ScanOutcome | null | Promise<ScanOutcome | null>;

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type Status = "starting" | "live" | "denied" | "nocamera" | "insecure" | "failed";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] as const;
/** A code must leave the frame this long before it counts again — one item, one scan. */
const COOLDOWN = 1500;

let detector: Promise<Detector> | null = null;

/** The phone's own detector when it has one (Android Chrome), else ZXing compiled to WASM, served from /public. */
function getDetector() {
  detector ??= (async (): Promise<Detector> => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (Native) {
      const supported = await Native.getSupportedFormats().catch(() => [] as string[]);
      if (supported.includes("ean_13") && supported.includes("code_128")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    }
    const { BarcodeDetector, prepareZXingModule, ZXING_WASM_VERSION } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/vendor/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path) },
    });
    return new BarcodeDetector({ formats: [...FORMATS] });
  })().catch((e) => {
    detector = null;
    throw e;
  });
  return detector;
}

let audio: AudioContext | null = null;

/** Call from the tap that opens the scanner — iOS only lets a gesture start audio. */
export function primeScanFeedback() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio — vibration and the on-screen log still confirm */
  }
}

function feedback(ok: boolean) {
  navigator.vibrate?.(ok ? 40 : [60, 50, 60]);
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = ok ? "sine" : "square";
  osc.frequency.value = ok ? 1760 : 220;
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (ok ? 0.09 : 0.25));
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

/**
 * Phone-camera barcode scanner (FR-POS-02). Scans continuously: every code
 * goes to `onCode`, whose answer is beeped and logged, so a shopkeeper can
 * scan a whole basket without closing the sheet.
 */
export function CameraScanner({
  open,
  onClose,
  onCode,
  title,
  sub,
}: {
  open: boolean;
  onClose: () => void;
  onCode: ScanHandler;
  title?: string;
  sub?: string;
}) {
  const t = useT();
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const added = log.filter((l) => l.ok).length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={440}
      title={title ?? t("Scan with camera", "ক্যামেরা দিয়ে স্ক্যান")}
      sub={sub ?? t("Point at the barcode on the label. Keep scanning — each item is added as you go.", "লেবেলের বারকোডে ক্যামেরা ধরুন। একটার পর একটা স্ক্যান করুন — সাথে সাথে যোগ হবে।")}
      footer={
        <Button variant="primary" className="w-full" onClick={onClose}>
          {added ? t(`Done · ${added} scanned`, `শেষ · ${added}টি স্ক্যান`) : t("Done", "শেষ")}
        </Button>
      }
    >
      {open && (
        <div className="space-y-4 p-4">
          <Viewfinder onCode={onCode} onResult={(r) => setLog((l) => [{ ...r, id: Date.now() }, ...l].slice(0, 8))} />
          <ScanLog log={log} />
        </div>
      )}
    </Sheet>
  );
}

/** Live camera with a reticle; every newly seen code goes to `onCode`, its answer is beeped and flashed. */
export function Viewfinder({ onCode, onResult, lang, className }: { onCode: ScanHandler; onResult: (r: ScanOutcome) => void; lang?: "en" | "bn"; className?: string }) {
  const storeT = useT();
  const t = lang ? makeT(lang) : storeT;
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [torch, setTorch] = useState<boolean | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; at: number } | null>(null);

  const handle = useEffectEvent(async (code: string) => {
    const r = await onCode(code);
    if (!r) return;
    feedback(r.ok);
    onResult(r);
    setFlash({ ok: r.ok, at: Date.now() });
  });

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let stream: MediaStream | null = null;
    const seen = new Map<string, number>();
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
      trackRef.current = null;
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setStatus("insecure");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      } catch (e) {
        const name = (e as DOMException).name;
        return setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "failed");
      }
      if (stopped) return stop();
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      if ((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(false);

      let reader: Detector;
      try {
        reader = await getDetector();
      } catch {
        stop();
        return setStatus("failed");
      }
      if (stopped) return;
      setStatus("live");

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          const found = await reader.detect(video).catch(() => []);
          const now = performance.now();
          for (const { rawValue } of found) {
            if (!rawValue) continue;
            const last = seen.get(rawValue);
            seen.set(rawValue, now);
            if (last === undefined || now - last > COOLDOWN) void handle(rawValue);
          }
        }
        timer = window.setTimeout(tick, 120);
      };
      void tick();
    })();

    return stop;
  }, []);

  const toggleTorch = async () => {
    const on = !torch;
    await trackRef.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(
      () => setTorch(on),
      () => setTorch(null),
    );
  };

  const problem: Partial<Record<Status, string>> = {
    denied: t("Camera access is blocked. Allow the camera for this site in your browser settings, then try again.", "ক্যামেরা বন্ধ করা আছে। ব্রাউজার সেটিংসে এই সাইটের জন্য ক্যামেরা চালু করে আবার চেষ্টা করুন।"),
    nocamera: t("No camera found on this device.", "এই ডিভাইসে ক্যামেরা পাওয়া যায়নি।"),
    insecure: t("The camera only works over a secure (https) connection.", "ক্যামেরা শুধু নিরাপদ (https) সংযোগে চলে।"),
    failed: t("The scanner couldn't start. Close this and try again.", "স্ক্যানার চালু হয়নি। বন্ধ করে আবার চেষ্টা করুন।"),
  };

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-lg bg-[#0b0c0d]", className)}>
      <video ref={videoRef} playsInline muted autoPlay className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", status === "live" ? "opacity-100" : "opacity-0")} />
      {/* Reticle: the dimmed surround points the eye (and the label) at the middle. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-[44%] w-[80%] rounded-md shadow-[0_0_0_100vmax_rgb(0_0_0/0.38)]">
          {(["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-md", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-md", "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-md", "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-md"] as const).map((pos) => (
            <span key={pos} className={cn("absolute size-6 transition-colors duration-150", pos, flash ? (flash.ok ? "border-ok" : "border-danger") : "border-white")} />
          ))}
          {status === "live" && <span className="absolute inset-x-3 h-0.5 rounded-full bg-white/85 shadow-[0_0_12px_rgb(255_255_255/0.7)] [animation:bk-scan_1.8s_ease-in-out_infinite_alternate]" />}
          {flash && <span key={flash.at} className={cn("absolute inset-0 rounded-md [animation:bk-fade-out_450ms_ease-out_forwards]", flash.ok ? "bg-ok/25" : "bg-danger/25")} />}
        </div>
      </div>
      {status !== "live" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          {problem[status] ? (
            <p className="max-w-[30ch] text-sm leading-relaxed text-white">{problem[status]}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-white/80">
              <Camera className="size-4 animate-pulse" />
              {t("Starting camera…", "ক্যামেরা চালু হচ্ছে…")}
            </p>
          )}
        </div>
      )}
      {torch !== null && (
        <IconButton
          label={torch ? t("Torch off", "লাইট বন্ধ") : t("Torch on", "লাইট জ্বালান")}
          onClick={toggleTorch}
          aria-pressed={torch}
          className={cn("absolute right-3 top-3 rounded-full", torch ? "bg-white text-ink hover:bg-white" : "bg-black/55 text-white hover:bg-black/70 hover:text-white")}
        >
          <Flashlight className="size-5" weight={torch ? "fill" : "regular"} />
        </IconButton>
      )}
    </div>
  );
}

/** Most recent first; older entries fade so the latest scan reads at a glance. */
export function ScanLog({ log, lang, empty }: { log: ScanLogEntry[]; lang?: "en" | "bn"; empty?: string }) {
  const storeT = useT();
  const t = lang ? makeT(lang) : storeT;
  return log.length ? (
    <ul className="divide-y divide-line rounded-lg border border-line" aria-live="polite">
      {log.map((l, i) => (
        <li key={l.id} className={cn("flex items-start gap-3 px-3 py-2.5 transition-opacity", i > 0 && "opacity-70")}>
          {l.ok ? <CheckCircle className="mt-0.5 size-5 shrink-0 text-ok" weight="fill" /> : <WarningCircle className="mt-0.5 size-5 shrink-0 text-danger" weight="fill" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-ink">{l.title}</span>
            {l.detail && <span className="block truncate text-xs text-ink-3">{l.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-center text-[13px] text-ink-3">{empty ?? t("Hold the label about a hand's length away, in good light.", "লেবেলটি এক হাত দূরে, ভালো আলোতে ধরুন।")}</p>
  );
}
