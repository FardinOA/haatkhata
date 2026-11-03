/**
 * Rule-based extraction of customer details from a pasted Messenger /
 * WhatsApp message (SRS FR-POS-10). Handles Bangla, Banglish and English,
 * Bangla digits, +88 prefixes and loosely formatted phone numbers.
 */
import { normalizePhone } from "../../lib/domain";
import { DHAKA_AREAS, DISTRICTS } from "../../lib/geo";
import type { Address } from "../../lib/types";

export type ParsedMessage = {
  name?: string;
  phone?: string;
  address?: Address;
  /** Text that wasn't recognised — usually the item request ("2ta kurti M size"). */
  leftover?: string;
  found: { name: boolean; phone: boolean; address: boolean };
};

const BN = "০১২৩৪৫৬৭৮৯";
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

/** Old spellings and Bangla-script names that sellers commonly type. */
const DISTRICT_ALIASES: [RegExp, string][] = [
  [/\bchittagong\b|\bctg\b/i, "Chattogram"],
  [/\bcomilla\b/i, "Cumilla"],
  [/\bbarisal\b/i, "Barishal"],
  [/\bjessore\b/i, "Jashore"],
  [/\bbogra\b/i, "Bogura"],
  [/\bdacca\b/i, "Dhaka"],
  [/\bcox'?s\s*bazar\b/i, "Cox's Bazar"],
];

const AREA_BN: [string, string][] = [
  ["মিরপুর", "Mirpur"], ["উত্তরা", "Uttara"], ["ধানমন্ডি", "Dhanmondi"], ["মোহাম্মদপুর", "Mohammadpur"],
  ["গুলশান", "Gulshan"], ["বনানী", "Banani"], ["বাড্ডা", "Badda"], ["রামপুরা", "Rampura"], ["বনশ্রী", "Banasree"],
  ["যাত্রাবাড়ী", "Jatrabari"], ["বসুন্ধরা", "Bashundhara"], ["খিলগাঁও", "Khilgaon"], ["মালিবাগ", "Malibagh"],
  ["মগবাজার", "Mogbazar"], ["ফার্মগেট", "Farmgate"], ["তেজগাঁও", "Tejgaon"], ["লালবাগ", "Lalbag"], ["সাভার", "Savar"],
  ["মতিঝিল", "Motijheel"], ["শ্যামলী", "Shyamoli"], ["আজিমপুর", "Azimpur"], ["পল্লবী", "Pallabi"], ["মহাখালী", "Mohakhali"],
  ["খিলক্ষেত", "Khilkhet"], ["আশুলিয়া", "Ashulia"], ["কেরানীগঞ্জ", "Keraniganj"], ["ডেমরা", "Demra"],
];

const ADDRESS_HINT = /(house|home|road|rd\.?|lane|sector|block|flat|floor|holding|village|vill|para|bazar|thana|upazila|post|basha|bari|বাসা|বাড়ি|রোড|সড়ক|ফ্ল্যাট|সেক্টর|ব্লক|গ্রাম|থানা|পাড়া|লেন)/i;
const NAME_LABEL = /(?:^|\s|\b)(?:name|naam|nam|নাম)\s*(?:is|holo|hocche|হলো|হচ্ছে)?\s*[:：\-–=]?\s*/i;
const ADDR_LABEL = /(?:address|addr|adress|thikana|thikana|ঠিকানা)\s*(?:holo|হলো)?\s*[:：\-–=]?\s*/i;
const PHONE_LABEL = /(?:phone|mobile|mob|number|num|no\.?|cell|contact|ফোন|মোবাইল|নম্বর|নাম্বার)\s*[:：\-–=]?\s*/gi;
const PHONE_RE = /(?:\+?\s*8\s*8[\s-]*)?0?1[3-9](?:[\s-]*\d){8}/;

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:।|\-–]+|[\s,.;:।|\-–]+$/g, "")
    .trim();

function findDistrict(text: string): { en: string; match: string } | null {
  let best: { en: string; match: string; idx: number } | null = null;
  for (const [en, bn] of DISTRICTS) {
    const re = new RegExp(`(^|[^a-z])${en.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")}(?![a-z])`, "i");
    const m = re.exec(text);
    if (m) {
      const idx = m.index + m[1].length;
      if (!best || idx > best.idx) best = { en, match: text.substr(idx, en.length), idx };
    }
    const bi = text.lastIndexOf(bn);
    if (bi >= 0 && (!best || bi > best.idx)) best = { en, match: bn, idx: bi };
  }
  if (best) return { en: best.en, match: best.match };
  for (const [re, en] of DISTRICT_ALIASES) {
    const m = re.exec(text);
    if (m) return { en, match: m[0] };
  }
  return null;
}

function findArea(text: string): { en: string; match: string } | null {
  const ascii = toAscii(text);
  // Longest first so "Mirpur 10" wins over "Mirpur".
  const sorted = [...DHAKA_AREAS].sort((a, b) => b.length - a.length);
  for (const a of sorted) {
    const pattern = a.replace(/\s+/g, "[\\s-]*");
    const m = new RegExp(`(^|[^a-z])(${pattern})(?![a-z0-9])`, "i").exec(ascii);
    if (m) return { en: a, match: text.substr(m.index + m[1].length, m[2].length) };
  }
  for (const [bn, en] of AREA_BN) {
    const m = new RegExp(`${bn}(?:[\\s-]*([০-৯0-9]{1,2}))?`).exec(text);
    if (m) {
      const num = m[1] ? toAscii(m[1]) : "";
      const withNum = num ? `${en} ${num}` : en;
      const known = DHAKA_AREAS.find((x) => x.toLowerCase() === withNum.toLowerCase());
      return { en: known ?? withNum, match: m[0] };
    }
  }
  return null;
}

function looksLikeName(s: string) {
  const c = clean(s);
  if (!c || /\d/.test(toAscii(c))) return false;
  if (ADDRESS_HINT.test(c)) return false;
  const words = c.split(" ");
  if (words.length > 4 || c.length > 40) return false;
  if (/^(hi|hello|salam|assalamu|apu|vai|bhai|vaiya|ji|ok|thanks|price|dam|koto)\b/i.test(c)) return false;
  return /^[\p{L}.' ]+$/u.test(c);
}

const titleCase = (s: string) => (/[a-z]/.test(s) ? s.replace(/\b([a-z])/g, (m) => m.toUpperCase()) : s);

export function parseMessage(raw: string): ParsedMessage {
  const text = raw.replace(/\r/g, "").trim();
  const out: ParsedMessage = { found: { name: false, phone: false, address: false } };
  if (!text) return out;

  // --- phone
  const ascii = toAscii(text);
  const pm = PHONE_RE.exec(ascii);
  let rest = text;
  if (pm) {
    const phone = normalizePhone(pm[0]);
    if (phone) {
      out.phone = phone;
      out.found.phone = true;
      // Remove the same span from the original (positions match: digit mapping is 1:1).
      rest = text.slice(0, pm.index) + " \n " + text.slice(pm.index + pm[0].length);
    }
  }
  rest = rest.replace(PHONE_LABEL, (m) => (/[a-zA-Zঀ-৿]/.test(m) ? " " : m));

  // --- explicit labels
  let nameStr: string | undefined;
  let addrStr: string | undefined;
  const lines = rest
    .split(/\n|।/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!addrStr) {
      const am = ADDR_LABEL.exec(line);
      if (am) addrStr = clean(line.slice(am.index + am[0].length));
    }
    if (!nameStr) {
      const nm = NAME_LABEL.exec(line);
      if (nm && !ADDR_LABEL.test(line.slice(0, nm.index + 3))) {
        const after = line.slice(nm.index + nm[0].length);
        const cut = after.split(/[,;|]|\.(?:\s|$)|\s(?:address|thikana|ঠিকানা|phone|number|mobile)\b/i)[0];
        if (clean(cut)) nameStr = clean(cut);
      }
    }
  }

  // --- unlabelled: comma segments of each line
  const segments = lines.flatMap((l) => l.split(/[,;|]/).map(clean)).filter(Boolean);
  const usedForName = new Set<string>();
  if (!nameStr) {
    const cand = segments.find((s) => looksLikeName(s) && !findDistrict(s) && !findArea(s));
    if (cand) {
      nameStr = cand;
      usedForName.add(cand);
    }
  }

  if (!addrStr) {
    // Address = lines (or segments) that mention a place or address keywords.
    const addrLines = lines.filter((l) => {
      const c = clean(l);
      if (!c || (nameStr && clean(c) === nameStr)) return false;
      return ADDRESS_HINT.test(c) || !!findDistrict(c) || !!findArea(c);
    });
    if (addrLines.length) {
      addrStr = clean(
        addrLines
          .join(", ")
          .split(/[,;|]/)
          .map(clean)
          .filter((s) => s && !usedForName.has(s) && s !== nameStr)
          .join(", "),
      );
    }
  }

  // --- district / area
  if (addrStr) {
    const district = findDistrict(addrStr);
    const area = findArea(addrStr);
    let line = addrStr;
    if (district) line = line.replace(district.match, "");
    let areaName = area?.en ?? "";
    if (area) line = line.replace(area.match, "");
    let districtName = district?.en ?? (area ? "Dhaka" : "");
    if (!area && district) {
      // Outside Dhaka: the segment right before the district is usually the area.
      const segs = addrStr.split(/[,;|]/).map(clean).filter(Boolean);
      const di = segs.findIndex((s) => s.includes(district.match));
      const prev = di > 0 ? segs[di - 1] : undefined;
      if (prev && !ADDRESS_HINT.test(prev) && !/\d/.test(toAscii(prev))) {
        areaName = prev;
        line = line.replace(prev, "");
      }
    }
    if (!districtName) districtName = "";
    line = clean(line.replace(/\s*,\s*(,\s*)+/g, ", ").replace(/\s{2,}/g, " "));
    line = line.replace(/(^,\s*)|(\s*,\s*$)/g, "");
    out.address = { line: titleCase(line), area: areaName, district: districtName };
    out.found.address = !!(line || areaName || districtName);
  }

  if (nameStr) {
    out.name = titleCase(nameStr.replace(/^(i am|this is|ami|amar)\s+/i, ""));
    out.found.name = true;
  }

  // --- leftover (what the customer wants to buy, etc.)
  const consumed = [nameStr, addrStr].filter(Boolean) as string[];
  const leftover = lines
    .map((l) => clean(l.replace(NAME_LABEL, "").replace(ADDR_LABEL, "")))
    .filter((l) => l && !consumed.some((c) => c.includes(l) || l.includes(c)) && !(out.address && (findDistrict(l) || findArea(l))))
    .join(" · ");
  if (leftover) out.leftover = leftover;
  return out;
}
