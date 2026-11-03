import "server-only";
/**
 * SMS gateway adapter (SRS §5.3). Drivers:
 *  - console     — development: prints messages to the server log
 *  - bulksmsbd   — BulkSMSBD HTTP API (api_key, senderid)
 *  - sslwireless — SSL Wireless ISMS API (api_token, sid)
 * Set SMS_DRIVER, SMS_API_KEY and SMS_SENDER_ID.
 */
export type SmsResult = { ok: boolean; provider: string; id?: string; error?: string };

const toIntl = (phone: string) => `88${phone}`; // 01XXXXXXXXX → 8801XXXXXXXXX

export const sentInDev: { to: string; text: string; at: string }[] = [];

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const driver = process.env.SMS_DRIVER ?? "console";
  try {
    if (driver === "bulksmsbd") {
      const u = new URL("https://bulksmsbd.net/api/smsapi");
      u.searchParams.set("api_key", process.env.SMS_API_KEY ?? "");
      u.searchParams.set("type", "text");
      u.searchParams.set("number", toIntl(to));
      u.searchParams.set("senderid", process.env.SMS_SENDER_ID ?? "");
      u.searchParams.set("message", text);
      const res = await fetch(u, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { response_code?: number; error_message?: string };
      return { ok: body.response_code === 202, provider: driver, error: body.error_message };
    }
    if (driver === "sslwireless") {
      const res = await fetch("https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_token: process.env.SMS_API_KEY, sid: process.env.SMS_SENDER_ID, msisdn: toIntl(to), sms: text, csms_id: `bk${Date.now()}` }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string; error_message?: string; smsinfo?: { sms_status?: string; reference_id?: string }[] };
      return { ok: body.status === "SUCCESS", provider: driver, id: body.smsinfo?.[0]?.reference_id, error: body.error_message };
    }
    console.info(`[sms:console] to ${to}: ${text}`);
    sentInDev.push({ to, text, at: new Date().toISOString() });
    if (sentInDev.length > 200) sentInDev.shift();
    return { ok: true, provider: "console" };
  } catch (e) {
    return { ok: false, provider: driver, error: (e as Error).message };
  }
}
