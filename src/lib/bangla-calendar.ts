/**
 * Bangla (Bengali) calendar date per Bangladesh's revised calendar (2019):
 * the year starts on 14 April (Pohela Boishakh); Boishakh–Ashwin have 31 days,
 * Kartik–Magh and Choitro 30, and Falgun 29 (30 in a Gregorian leap year).
 */
export const BANGLA_MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"];
export const BANGLA_MONTHS_EN = ["Boishakh", "Joishtho", "Asharh", "Srabon", "Bhadro", "Ashwin", "Kartik", "Ogrohayon", "Poush", "Magh", "Falgun", "Choitro"];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function toBanglaDate(d: Date) {
  const y = d.getFullYear();
  const boishakh = new Date(y, 3, 14);
  const startYear = d >= boishakh ? y : y - 1;
  const start = new Date(startYear, 3, 14);
  let offset = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000);
  // Falgun falls in the Gregorian year after the Bangla year begins.
  const lengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, isLeap(startYear + 1) ? 30 : 29, 30];
  let month = 0;
  while (month < 11 && offset >= lengths[month]) {
    offset -= lengths[month];
    month++;
  }
  return { day: offset + 1, month, year: startYear - 593 };
}
