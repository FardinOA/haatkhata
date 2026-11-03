import { afterEach, describe, expect, it, vi } from "vitest";
import { attachDesktop, attachPhone, eventStream, newPairToken, phoneOrigin, sendCode, sendResult, tokenBelongsTo, TOKEN_RE, type DesktopEvent, type PhoneEvent } from "./scan-relay";

vi.mock("node:os", () => ({
  networkInterfaces: () => ({
    lo0: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
    bridge0: [{ family: "IPv4", internal: false, address: "169.254.10.2" }],
    en0: [{ family: "IPv4", internal: false, address: "192.168.1.42" }],
  }),
}));

const sink = <E,>() => {
  const got: E[] = [];
  return { got, send: (e: E) => void got.push(e) };
};

describe("scanner links", () => {
  it("are signed for one shop", () => {
    const token = newPairToken("b_one");
    expect(token).toMatch(TOKEN_RE);
    expect(tokenBelongsTo(token, "b_one")).toBe(true);
    expect(tokenBelongsTo(token, "b_two")).toBe(false);
    expect(tokenBelongsTo(`${token.slice(0, -2)}xx`, "b_one")).toBe(false);
    expect(tokenBelongsTo("not-a-token", "b_one")).toBe(false);
  });

  it("are different every time", () => {
    expect(newPairToken("b_one")).not.toBe(newPairToken("b_one"));
  });
});

describe("relay", () => {
  it("tells each side when the other comes and goes", () => {
    const token = newPairToken("b_presence");
    const desk = sink<DesktopEvent>();
    const phone = sink<PhoneEvent>();
    const leaveDesk = attachDesktop(token, desk.send);
    expect(desk.got).toEqual([{ type: "phone", connected: false }]);
    const leavePhone = attachPhone(token, phone.send);
    expect(phone.got).toEqual([{ type: "desktop", connected: true }]);
    expect(desk.got.at(-1)).toEqual({ type: "phone", connected: true });
    leaveDesk();
    expect(phone.got.at(-1)).toEqual({ type: "desktop", connected: false });
    leavePhone();
  });

  it("drops a scan when no computer is listening", () => {
    expect(sendCode(newPairToken("b_empty"), "1", "123")).toBe(false);
  });

  it("delivers a scan to the newest order-screen tab only, so it isn't added twice", () => {
    const token = newPairToken("b_tabs");
    const older = sink<DesktopEvent>();
    const newer = sink<DesktopEvent>();
    const a = attachDesktop(token, older.send);
    const b = attachDesktop(token, newer.send);
    expect(sendCode(token, "s1", "2000000000015")).toBe(true);
    expect(newer.got.filter((e) => e.type === "code")).toEqual([{ type: "code", id: "s1", code: "2000000000015" }]);
    expect(older.got.some((e) => e.type === "code")).toBe(false);
    a();
    b();
  });

  it("sends the computer's answer back to the phone", () => {
    const token = newPairToken("b_answer");
    const phone = sink<PhoneEvent>();
    const leave = attachPhone(token, phone.send);
    sendResult(token, { type: "result", id: "s1", ok: true, title: "Kurti", detail: "1 in cart" });
    expect(phone.got.at(-1)).toEqual({ type: "result", id: "s1", ok: true, title: "Kurti", detail: "1 in cart" });
    leave();
  });

  it("refuses a flood of scans from one link", () => {
    const token = newPairToken("b_flood");
    const leave = attachDesktop(token, () => {});
    const sent = Array.from({ length: 70 }, (_, i) => sendCode(token, String(i), "123"));
    expect(sent.filter(Boolean)).toHaveLength(60);
    leave();
  });
});

describe("event stream", () => {
  it("streams events and detaches when the client hangs up", async () => {
    const ctl = new AbortController();
    const detach = vi.fn();
    let push: (e: { n: number }) => void = () => {};
    const res = eventStream<{ n: number }>(new Request("http://x/", { signal: ctl.signal }), (send) => {
      push = send;
      return detach;
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-transform");
    const reader = res.body!.getReader();
    push({ n: 1 });
    let text = "";
    while (!text.includes('data: {"n":1}')) text += new TextDecoder().decode((await reader.read()).value);
    expect(text.startsWith("retry: 2000")).toBe(true);
    ctl.abort();
    expect(detach).toHaveBeenCalledOnce();
  });
});

describe("phone address", () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it("uses APP_URL when set", () => {
    vi.stubEnv("APP_URL", "https://shop.example.com/");
    expect(phoneOrigin(req("http://localhost:3000/api/scan/pair"))).toBe("https://shop.example.com");
  });

  it("swaps localhost for this machine's Wi-Fi address, keeping scheme and port", () => {
    vi.stubEnv("APP_URL", "");
    expect(phoneOrigin(req("https://localhost:3001/api/scan/pair", { host: "localhost:3001" }))).toBe("https://192.168.1.42:3001");
  });

  it("keeps a public host as it is, behind a proxy too", () => {
    vi.stubEnv("APP_URL", "");
    expect(phoneOrigin(req("http://127.0.0.1:3000/x", { "x-forwarded-host": "abc.devtunnels.ms", "x-forwarded-proto": "https" }))).toBe("https://abc.devtunnels.ms");
  });
});
