import { describe, expect, it } from "vitest";
import { parseMessage } from "./parse-message";

describe("parseMessage", () => {
  it("reads a labelled Bangla message with Bangla digits", () => {
    const r = parseMessage("নাম: রাফিয়া সুলতানা\nফোন: ০১৭১২-৩৪৫৬৭৮\nঠিকানা: বাসা ১২, রোড ৫, মিরপুর ১০, ঢাকা");
    expect(r.name).toBe("রাফিয়া সুলতানা");
    expect(r.phone).toBe("01712345678");
    expect(r.address?.district).toBe("Dhaka");
    expect(r.address?.area).toBe("Mirpur 10");
    expect(r.address?.line).toContain("বাসা ১২");
  });

  it("reads a single comma-separated English line", () => {
    const r = parseMessage("Name - Tasnim Akter, 01812345678, House 23 Road 7, Dhanmondi, Dhaka");
    expect(r.name).toBe("Tasnim Akter");
    expect(r.phone).toBe("01812345678");
    expect(r.address).toEqual({ line: "House 23 Road 7", area: "Dhanmondi", district: "Dhaka" });
  });

  it("handles Banglish and a +88 prefix", () => {
    const r = parseMessage("amar nam Sadia Islam. number +8801911223344. address: Agrabad, Chattogram");
    expect(r.name).toBe("Sadia Islam");
    expect(r.phone).toBe("01911223344");
    expect(r.address?.district).toBe("Chattogram");
    expect(r.address?.area).toBe("Agrabad");
  });

  it("finds an unlabelled name on its own line and keeps the item request as leftover", () => {
    const r = parseMessage("01711-223344\nAyesha Rahman\nKandirpar, Cumilla\n2ta kurti M size");
    expect(r.phone).toBe("01711223344");
    expect(r.name).toBe("Ayesha Rahman");
    expect(r.address?.district).toBe("Cumilla");
    expect(r.address?.area).toBe("Kandirpar");
    expect(r.leftover).toContain("kurti");
  });

  it("accepts phone numbers with spaces", () => {
    const r = parseMessage("Rafiq Hossain 01712 345 678\nUttara sector 7, house 19");
    expect(r.phone).toBe("01712345678");
    expect(r.address?.area).toBe("Uttara Sector 7");
    expect(r.address?.district).toBe("Dhaka");
  });

  it("maps old district spellings", () => {
    const r = parseMessage("Nabila\n01611556677\nSatmatha, Bogra");
    expect(r.address?.district).toBe("Bogura");
    expect(r.name).toBe("Nabila");
  });

  it("does not invent a phone from an invalid number", () => {
    const r = parseMessage("call me at 0123456789, Banani");
    expect(r.phone).toBeUndefined();
    expect(r.address?.area).toBe("Banani");
  });

  it("returns nothing for an empty paste", () => {
    const r = parseMessage("   ");
    expect(r.found).toEqual({ name: false, phone: false, address: false });
  });

  it("ignores greetings when guessing a name", () => {
    const r = parseMessage("Assalamu alaikum apu\nFarhana Chowdhury\n01815443322\nGulshan 2, Dhaka");
    expect(r.name).toBe("Farhana Chowdhury");
    expect(r.address?.area).toBe("Gulshan 2");
  });

  it("reads a Bangla area without an explicit district", () => {
    const r = parseMessage("নাম: মিম\n০১৯১১২২৩৩৪৪\nধানমন্ডি ২৭, রোড ৮");
    expect(r.phone).toBe("01911223344");
    expect(r.address?.area).toMatch(/^Dhanmondi/);
    expect(r.address?.district).toBe("Dhaka");
  });
});
