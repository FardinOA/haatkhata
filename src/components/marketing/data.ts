/** Copy for the marketing site, [English, Bangla] throughout. */

export const PLANS = [
  { name: ["Starter", "স্টার্টার"], price: 299, orders: 500, products: ["300 products", "৩০০টি পণ্য"], users: ["2 users", "২ জন ইউজার"], extra: [["Sizes & colours", "সাইজ ও রং"], ["Excel import, suppliers, labels", "এক্সেল ইমপোর্ট, সাপ্লায়ার, লেবেল"]], who: ["Home-based sellers", "ঘরে বসে বিক্রেতা"] },
  { name: ["Business", "বিজনেস"], price: 799, orders: 2500, products: ["Unlimited products", "আনলিমিটেড পণ্য"], users: ["5 users with roles", "রোলসহ ৫ জন ইউজার"], extra: [["Returns & COD tracking", "রিটার্ন ও COD হিসাব"], ["Real profit report, offline POS", "আসল লাভের রিপোর্ট, অফলাইন POS"]], who: ["Growing pages", "বড় হতে থাকা পেজ"], featured: true },
  { name: ["Pro", "প্রো"], price: 1999, orders: 10000, products: ["Unlimited products", "আনলিমিটেড পণ্য"], users: ["Unlimited users", "আনলিমিটেড ইউজার"], extra: [["Custom roles & audit log", "নিজের রোল ও অডিট লগ"], ["Several shops, priority support", "একাধিক দোকান, অগ্রাধিকার সাপোর্ট"]], who: ["Brands & hybrid shops", "ব্র্যান্ড ও দোকান+অনলাইন"] },
] as const;

export type Proof = "catalogue" | "offline" | "print" | "cod" | "staff" | "data" | "scan";

/** Questions sellers ask, the proof each answer shows, and the words (both languages) a typed question is matched on. */
/** `chip: false` answers typed questions but stays out of the suggestions (pricing already shows it). */
export const FAQ: { q: [string, string]; a: [string, string]; proof?: Proof; kw: string[]; chip?: false }[] = [
  {
    q: ["Do I need a website?", "ওয়েবসাইট লাগবে?"],
    a: ["No. HaatKhata is built for sellers who take orders in Facebook, Instagram and WhatsApp chats. If you want one, every shop gets a catalogue link to share.", "না। হাটখাতা তৈরি তাদের জন্য যারা ফেসবুক, ইনস্টাগ্রাম আর হোয়াটসঅ্যাপ চ্যাটে অর্ডার নেন। চাইলে প্রতিটা দোকান শেয়ার করার মতো একটা ক্যাটালগ লিংকও পায়।"],
    proof: "catalogue",
    kw: ["website", "site", "web", "catalog", "link", "domain", "ওয়েবসাইট", "সাইট", "ক্যাটালগ", "লিংক", "ওয়েব"],
  },
  {
    q: ["Will it work on my phone and with bad internet?", "আমার ফোনে আর দুর্বল নেটে চলবে?"],
    a: ["Yes. It's made for budget Android phones, installs like an app, and keeps taking orders offline. Everything syncs when the connection comes back.", "হ্যাঁ। কম দামের অ্যান্ড্রয়েডের জন্যই বানানো, অ্যাপের মতো ইনস্টল হয়, আর ইন্টারনেট না থাকলেও অর্ডার নেওয়া যায়। নেট ফিরলে সব সিঙ্ক হয়ে যায়।"],
    proof: "offline",
    kw: ["internet", "offline", "net", "phone", "android", "mobile", "slow", "app", "install", "ইন্টারনেট", "নেট", "অফলাইন", "ফোন", "মোবাইল", "অ্যান্ড্রয়েড", "অ্যাপ"],
  },
  {
    q: ["Can I print on my thermal printer?", "থার্মাল প্রিন্টারে প্রিন্ট করা যাবে?"],
    a: ["Yes. 58 mm and 80 mm POS rolls, A5, A4 or Letter, two copies on one A4, and parcel labels from small stickers to 4×6 inch — or 8 on an A4 sheet. Each computer remembers its own printer.", "হ্যাঁ। ৫৮ ও ৮০ মিমি POS রোল, A5, A4 বা লেটার, এক A4-এ দুই কপি, আর ছোট স্টিকার থেকে ৪×৬ ইঞ্চি পার্সেল লেবেল — অথবা এক A4-এ ৮টি। প্রতিটা কম্পিউটার নিজের প্রিন্টার মনে রাখে।"],
    proof: "print",
    kw: ["print", "printer", "thermal", "receipt", "label", "sticker", "a4", "a5", "memo", "paper", "প্রিন্ট", "প্রিন্টার", "থার্মাল", "রসিদ", "লেবেল", "স্টিকার", "মেমো", "কাগজ"],
  },
  {
    q: ["Do I need a barcode scanner?", "বারকোড স্ক্যানার কিনতে হবে?"],
    a: ["No. Your phone's camera is the scanner. Selling from the phone, it scans straight into the cart; at a computer, scan its QR once and the phone sends every barcode to it over the internet. Print your own barcode labels too. A USB scanner works if you already have one.", "না। ফোনের ক্যামেরাই স্ক্যানার। ফোনে বিক্রি করলে সোজা কার্টে স্ক্যান হয়; কম্পিউটারে বিক্রি করলে তার QR একবার স্ক্যান করুন, ফোন প্রতিটি বারকোড কম্পিউটারে পাঠিয়ে দেবে। নিজের বারকোড লেবেলও প্রিন্ট করতে পারবেন। আগে থেকে USB স্ক্যানার থাকলে সেটাও চলে।"],
    proof: "scan",
    kw: ["scanner", "scan", "barcode", "barcode label", "camera", "qr", "gun", "sku", "বারকোড লেবেল", "স্ক্যানার", "স্ক্যান", "বারকোড", "ক্যামেরা", "কিউআর"],
  },
  {
    q: ["How does it handle couriers and COD?", "কুরিয়ার আর COD কীভাবে সামলায়?"],
    a: ["Every order carries its courier, tracking number and the exact COD to collect. When the courier pays you, mark the payout and HaatKhata shows what's still out there, courier by courier.", "প্রতিটা অর্ডারে কুরিয়ার, ট্র্যাকিং নম্বর আর কত COD আদায় করতে হবে তা থাকে। কুরিয়ার টাকা দিলে পেআউট মার্ক করুন — কোন কুরিয়ারের কাছে কত বাকি সব দেখা যায়।"],
    proof: "cod",
    kw: ["courier", "cod", "cash on delivery", "steadfast", "sundarban", "delivery", "parcel", "tracking", "payout", "কুরিয়ার", "ডেলিভারি", "পার্সেল", "ক্যাশ", "স্টেডফাস্ট", "সুন্দরবন", "ট্র্যাকিং"],
  },
  {
    q: ["Can my staff use it without seeing my profit?", "স্টাফ ব্যবহার করবে, কিন্তু আমার লাভ দেখবে না?"],
    a: ["Yes. Give each person their own login and role. Sales staff take orders but never see buying prices or profit.", "হ্যাঁ। প্রত্যেককে আলাদা লগইন আর রোল দিন। সেলস স্টাফ অর্ডার নেবে, কিন্তু কেনা দাম বা লাভ দেখবে না।"],
    proof: "staff",
    kw: ["staff", "employee", "team", "role", "profit", "permission", "user", "login", "স্টাফ", "কর্মী", "লাভ", "রোল", "টিম", "ইউজার", "লগইন"],
  },
  {
    q: ["Is my data mine?", "আমার তথ্য কি আমার?"],
    a: ["Always. Download everything as a file whenever you like. If your plan ends, nothing is deleted: you can still read and export it all, and renewing lets you sell again.", "সবসময়। যখন খুশি সব তথ্য ফাইল হিসেবে ডাউনলোড করুন। প্ল্যান শেষ হলেও কিছু মুছে যায় না — সব দেখা আর এক্সপোর্ট করা যায়, রিনিউ করলেই আবার বিক্রি শুরু।"],
    proof: "data",
    kw: ["data", "export", "backup", "download", "delete", "privacy", "safe", "excel", "তথ্য", "ডেটা", "ব্যাকআপ", "ডাউনলোড", "এক্সপোর্ট", "মুছে", "নিরাপদ"],
  },

  {
    q: ["How do I pay?", "পেমেন্ট কীভাবে করব?"],
    a: ["With bKash, monthly or yearly. Pay yearly and get two months off. No setup fee. The plans are in the pricing section above.", "বিকাশে, মাসিক বা বার্ষিক। বার্ষিক দিলে দুই মাস ছাড়। সেটআপ ফি নেই। প্ল্যানগুলো ওপরের দামের অংশে আছে।"],
    chip: false,
    kw: ["pay", "price", "cost", "bkash", "nagad", "card", "plan", "fee", "yearly", "monthly", "subscription", "পেমেন্ট", "দাম", "বিকাশ", "নগদ", "খরচ", "প্ল্যান", "ফি", "কত টাকা"],
  },
];

/** Best FAQ for a typed question, or -1 when nothing matches. */
export function matchFaq(text: string) {
  const q = text.toLowerCase();
  // Whole words, prefix-matched so Bangla endings still count (বিকাশে → বিকাশ) but অফিস never matches ফি.
  const words = q.split(/[\s,.?!।;:()"'\-/]+/).filter(Boolean);
  const hit = (k: string) => (k.includes(" ") ? q.includes(k) : words.some((w) => w.startsWith(k)));
  let best = -1;
  let score = 0;
  FAQ.forEach((f, i) => {
    const s = f.kw.reduce((n, k) => n + (hit(k) ? k.length : 0), 0);
    if (s > score) [best, score] = [i, s];
  });
  return best;
}
