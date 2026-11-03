import { ImageResponse } from "next/og";

export const alt = "BechaKena — every order, from the chat to the cash";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: the parcel journey, in the product's own colours. */
export default function OgImage() {
  const steps = ["Chat", "Order", "Invoice", "Courier", "Cash"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#F3F4F0", color: "#16181A", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#0E6B53", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 34, fontWeight: 700 }}>B</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>BechaKena</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, maxWidth: 900 }}>Every order, from the chat to the cash.</div>
          <div style={{ fontSize: 30, color: "#464B50" }}>Stock, invoices, couriers & COD for social sellers in Bangladesh</div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderRadius: 999, background: i === 4 ? "#F0A92B" : i === 0 ? "#0E6B53" : "white", color: i === 0 ? "white" : "#16181A", fontSize: 26, fontWeight: 700, border: "2px solid #CDD1C8" }}>{s}</div>
              {i < 4 && <div style={{ width: 54, height: 0, borderTop: "3px dashed #8f968f", margin: "0 8px" }} />}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
