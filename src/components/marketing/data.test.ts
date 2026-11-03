import { describe, expect, it } from "vitest";
import { FAQ, matchFaq } from "./data";

/** Which answer a typed question lands on, by the start of its English question. */
const proofOf = (q: string) => {
  const f = FAQ[matchFaq(q)];
  if (!f) return null;
  return ({ "How do I pay?": "pay" } as Record<string, string>)[f.q[0]] ?? f.proof ?? null;
};

describe("typed FAQ questions", () => {
  it("matches Bangla with word endings", () => {
    expect(proofOf("বিকাশে টাকা দিতে পারব?")).toBe("pay");
    expect(proofOf("থার্মাল প্রিন্টারে চলবে?")).toBe("print");
    expect(proofOf("নেট না থাকলে কী হবে")).toBe("offline");
  });

  it("matches English", () => {
    expect(proofOf("can I pay with bkash?")).toBe("pay");
    expect(proofOf("Does it work with Pathao?")).toBe("cod");
    expect(proofOf("can my staff see profit")).toBe("staff");
  });

  it("doesn't match a keyword hidden inside another word", () => {
    expect(proofOf("আপনাদের অফিস কোথায়?")).toBeNull();
    expect(proofOf("where is your office?")).toBeNull();
  });
});
