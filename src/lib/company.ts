/**
 * The business behind HaatKhata, as printed on the Terms, Privacy, Refund and
 * Contact pages. bKash checks these pages before approving a merchant
 * account, so fill in every empty value before applying. Empty values are
 * left off the pages rather than shown blank.
 */
export const COMPANY = {
  /** Name on the trade licence, e.g. "HaatKhata Technologies Ltd." Falls back to "HaatKhata". */
  legalName: "",
  tradeLicence: "",
  address: "",
  addressBn: "",
  email: "support@haatkhata.com",
  /** Local format, 01XXXXXXXXX. */
  phone: "",
  whatsapp: "",
  hours: ["Saturday to Thursday, 10 am to 8 pm", "শনি থেকে বৃহস্পতিবার, সকাল ১০টা থেকে রাত ৮টা"] as [string, string],
};

/** Who the legal pages name as the other party. */
export const operatorName = () => COMPANY.legalName || "HaatKhata";

/** The date printed at the top of every legal page. Change it whenever their text changes. */
export const LEGAL_UPDATED = "2026-11-03";
