import { describe, expect, it } from "vitest";
import { matchItems, readQty, type MatchEntry } from "./match-items";
import { parseMessage } from "../components/pos/parse-message";

const CATALOG: MatchEntry[] = [
  { productId: "p_kurti", variantId: "v_kurti_m_indigo", sku: "KRT-M-IND", name: "Block-print Kurti", nameBn: "ব্লক প্রিন্ট কুর্তি", options: "M / Indigo" },
  { productId: "p_kurti", variantId: "v_kurti_l_indigo", sku: "KRT-L-IND", name: "Block-print Kurti", nameBn: "ব্লক প্রিন্ট কুর্তি", options: "L / Indigo" },
  { productId: "p_kurti", variantId: "v_kurti_m_red", sku: "KRT-M-RED", name: "Block-print Kurti", nameBn: "ব্লক প্রিন্ট কুর্তি", options: "M / Red" },
  { productId: "p_jamdani", variantId: "v_jamdani", sku: "JMD-01", name: "Jamdani Saree", nameBn: "জামদানি শাড়ি", options: "" },
  { productId: "p_tant", variantId: "v_tant", sku: "TNT-01", name: "Tant Saree", nameBn: "তাঁত শাড়ি", options: "" },
  { productId: "p_shoe", variantId: "v_shoe_38", sku: "SHO-38", name: "Leather Sandal", options: "38" },
  { productId: "p_shoe", variantId: "v_shoe_40", sku: "SHO-40", name: "Leather Sandal", options: "40" },
];

describe("readQty", () => {
  it("reads digits with units, Bangla digits and Banglish words", () => {
    expect(readQty("2ta kurti")).toBe(2);
    expect(readQty("কুর্তি ৩টা")).toBe(3);
    expect(readQty("kurti x4")).toBe(4);
    expect(readQty("duita saree")).toBe(2);
    expect(readQty("saree")).toBeUndefined();
    expect(readQty("sandal 40")).toBeUndefined();
  });
});

describe("matchItems", () => {
  it("picks the variant from size and colour on the same line", () => {
    expect(matchItems("2ta kurti M size, indigo", CATALOG)).toEqual([{ productId: "p_kurti", variantId: "v_kurti_m_indigo", text: "2ta kurti M size, indigo", qty: 2 }]);
  });

  it("understands Banglish colours and Bangla names", () => {
    expect(matchItems("lal kurti M ekta", CATALOG)[0]).toMatchObject({ variantId: "v_kurti_m_red", qty: 1 });
    expect(matchItems("জামদানি শাড়ি ২টা", CATALOG)[0]).toMatchObject({ variantId: "v_jamdani", qty: 2 });
  });

  it("matches SKUs directly", () => {
    expect(matchItems("KRT-L-IND 2ta", CATALOG)[0]).toMatchObject({ variantId: "v_kurti_l_indigo", qty: 2 });
  });

  it("finds several items in one message", () => {
    const r = matchItems("1ta jamdani saree ar 2ta kurti L indigo", CATALOG);
    expect(r.map((i) => [i.variantId, i.qty])).toEqual([
      ["v_jamdani", 1],
      ["v_kurti_l_indigo", 2],
    ]);
  });

  it("tolerates a typo in the product name", () => {
    expect(matchItems("kurtti M red", CATALOG)[0]).toMatchObject({ variantId: "v_kurti_m_red" });
  });

  it("names the product but leaves the variant open when the size is missing", () => {
    expect(matchItems("sandal lagbe", CATALOG)).toEqual([{ productId: "p_shoe", variantId: undefined, text: "sandal lagbe", qty: 1 }]);
    expect(matchItems("sandal 40 size", CATALOG)[0]).toMatchObject({ variantId: "v_shoe_40" });
  });

  it("doesn't guess between equally likely products", () => {
    expect(matchItems("ekta saree", CATALOG)).toEqual([{ text: "ekta saree", qty: 1 }]);
  });

  it("ignores greetings and works on the leftover of a full chat", () => {
    const chat = "Assalamu alaikum apu\nনাম: ফারহানা চৌধুরী\n০১৮১৫-৪৪৩৩২২\nবাসা ৩৮, রোড ৩, মিরপুর ১০, ঢাকা\n2ta kurti M size, indigo";
    const left = parseMessage(chat).leftover ?? "";
    expect(matchItems(left, CATALOG)).toEqual([expect.objectContaining({ variantId: "v_kurti_m_indigo", qty: 2 })]);
    expect(matchItems("Assalamu alaikum, price koto?", CATALOG)).toEqual([]);
  });
});
