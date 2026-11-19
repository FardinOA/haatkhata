/**
 * Text of the Terms, Privacy and Refund pages as English/Bangla pairs. Each
 * section carries a one-line "short" version shown beside the full text.
 * Facts here must match the code: plans.ts (prices, terms, limits),
 * service.ts (GRACE_DAYS, reminders), print-quota.ts, session.ts (OTP
 * expiry), deploy/backup.sh (BACKUP_KEEP_DAYS) and the integrations folder.
 */
import { COMPANY, operatorName } from "@/lib/company";

export type Pair = readonly [en: string, bn: string];
export type Block = Pair | { list: Pair[] };
export type Section = { id: string; title: Pair; short: Pair; body: Block[] };
export type LegalSlug = "terms" | "privacy" | "refund";
export type LegalDoc = { title: Pair; intro: Pair; sections: Section[] };

const WHO = operatorName();
const MAIL = COMPANY.email;

const TERMS: LegalDoc = {
  title: ["Terms of Service", "ব্যবহারের শর্তাবলী"],
  intro: [
    `These terms are the agreement between you, the business owner who opens a HaatKhata account, and ${WHO} ("we"). By creating an account or using HaatKhata, you accept them. If you use HaatKhata for a business, you confirm you're allowed to accept them for that business.`,
    `এই শর্তাবলী আপনার (যে ব্যবসার মালিক হাটখাতা অ্যাকাউন্ট খোলেন) এবং ${WHO}-এর ("আমরা") মধ্যে চুক্তি। অ্যাকাউন্ট খুললে বা হাটখাতা ব্যবহার করলে আপনি এগুলো মেনে নিচ্ছেন। কোনো ব্যবসার পক্ষে ব্যবহার করলে, আপনি নিশ্চিত করছেন যে সেই ব্যবসার পক্ষে মেনে নেওয়ার অধিকার আপনার আছে।`,
  ],
  sections: [
    {
      id: "service",
      title: ["The service", "সেবাটি কী"],
      short: ["Software to run your shop's stock, orders and money.", "দোকানের স্টক, অর্ডার আর টাকার হিসাব রাখার সফটওয়্যার।"],
      body: [
        [
          "HaatKhata is software for recording stock, orders, invoices, deliveries and payments. It runs in a web browser and can be installed on a phone like an app.",
          "হাটখাতা স্টক, অর্ডার, ইনভয়েস, ডেলিভারি আর পেমেন্টের হিসাব রাখার সফটওয়্যার। এটা ব্রাউজারে চলে, আর ফোনে অ্যাপের মতো ইনস্টল করা যায়।",
        ],
        [
          "We keep improving HaatKhata, so features change. If a change takes away something your paid plan includes, we'll tell you in the app before it happens.",
          "আমরা হাটখাতা নিয়মিত উন্নত করি, তাই ফিচার বদলায়। কোনো পরিবর্তনে আপনার পেইড প্ল্যানের কোনো সুবিধা বাদ পড়লে, তার আগেই অ্যাপে জানিয়ে দেব।",
        ],
      ],
    },
    {
      id: "account",
      title: ["Your account", "আপনার অ্যাকাউন্ট"],
      short: ["You sign in with your phone, and you answer for your staff.", "ফোন নম্বরে সাইন ইন; স্টাফের কাজের দায় আপনার।"],
      body: [
        [
          "You sign in with a Bangladeshi mobile number and a one-time SMS code. Keep your phone and codes to yourself; anyone with them can open your shop.",
          "বাংলাদেশি মোবাইল নম্বর আর এককালীন SMS কোড দিয়ে সাইন ইন করতে হয়। ফোন আর কোড নিজের কাছে রাখুন; এগুলো যার কাছে থাকবে, সে আপনার দোকান খুলতে পারবে।",
        ],
        [
          "You can add staff and choose what each role may see and do. You are responsible for everything done in your account, including by your staff.",
          "আপনি স্টাফ যোগ করতে পারেন এবং কোন রোল কী দেখবে ও করবে ঠিক করতে পারেন। আপনার অ্যাকাউন্টে যা কিছু হয়, স্টাফের কাজসহ, তার দায় আপনার।",
        ],
      ],
    },
    {
      id: "plans",
      title: ["Trial, plans and payment", "ট্রায়াল, প্ল্যান ও পেমেন্ট"],
      short: ["7-day trial, then pay in advance. Nothing renews by itself.", "৭ দিনের ট্রায়াল, তারপর আগাম পেমেন্ট। নিজে থেকে কিছু রিনিউ হয় না।"],
      body: [
        [
          "A new shop gets a 7-day trial with the Business plan's features, with no payment details needed. Until a plan is paid, invoices, labels and other documents can be printed, saved or shared for 5 orders in total.",
          "নতুন দোকান বিজনেস প্ল্যানের সুবিধাসহ ৭ দিনের ট্রায়াল পায়, কোনো পেমেন্ট তথ্য লাগে না। প্ল্যানের টাকা দেওয়ার আগ পর্যন্ত মোট ৫টি অর্ডারের ইনভয়েস, লেবেল ও অন্যান্য ডকুমেন্ট প্রিন্ট, সেভ বা শেয়ার করা যায়।",
        ],
        [
          "Plans and prices are on the pricing page. Prices are in taka and include VAT. You pay in advance for one month, three months or a year; a year is charged as ten months.",
          "প্ল্যান ও দাম দামের পাতায় দেওয়া আছে। দাম টাকায়, ভ্যাটসহ। আপনি এক মাস, তিন মাস বা এক বছরের জন্য আগাম পেমেন্ট করেন; এক বছরের জন্য দশ মাসের দাম নেওয়া হয়।",
        ],
        [
          "Plans don't renew automatically. We remind you 7 days and 1 day before a plan ends, and it keeps working for 3 more days. After that the shop becomes read-only: you can still see and export everything, but you can't add orders, products or staff until you pay.",
          "প্ল্যান নিজে থেকে রিনিউ হয় না। প্ল্যান শেষ হওয়ার ৭ দিন ও ১ দিন আগে আমরা মনে করিয়ে দিই, আর শেষ হওয়ার পরও ৩ দিন চালু থাকে। তারপর দোকান শুধু দেখার মোডে চলে যায়: সব দেখা ও এক্সপোর্ট করা যাবে, কিন্তু পেমেন্ট না করা পর্যন্ত নতুন অর্ডার, প্রোডাক্ট বা স্টাফ যোগ করা যাবে না।",
        ],
        [
          "Each plan has a monthly order limit. When you reach it, new orders wait until next month or until you move to a bigger plan.",
          "প্রতিটা প্ল্যানে মাসিক অর্ডারের সীমা আছে। সীমা পূর্ণ হলে পরের মাস পর্যন্ত বা বড় প্ল্যানে যাওয়া পর্যন্ত নতুন অর্ডার নেওয়া যাবে না।",
        ],
        [
          "If prices change, we'll announce it at least 30 days ahead. New prices apply from your next payment, never to time you've already paid for. Refunds follow the Refund Policy.",
          "দাম বদলালে অন্তত ৩০ দিন আগে জানাব। নতুন দাম আপনার পরের পেমেন্ট থেকে প্রযোজ্য, আগে পরিশোধ করা সময়ের ওপর নয়। রিফান্ড হয় রিফান্ড নীতি অনুযায়ী।",
        ],
      ],
    },
    {
      id: "data",
      title: ["Your data", "আপনার তথ্য"],
      short: ["Your shop's data is yours. Export it any time.", "দোকানের তথ্য আপনার। যখন খুশি এক্সপোর্ট করুন।"],
      body: [
        [
          "Your products, orders, customers and figures belong to you. You let us store and process them only to run HaatKhata for you, as described in the Privacy Policy. You can export them at any time, including after your plan ends.",
          "আপনার প্রোডাক্ট, অর্ডার, কাস্টমার আর হিসাব আপনার। শুধু আপনার জন্য হাটখাতা চালাতে আমরা এগুলো রাখি ও ব্যবহার করি, গোপনীয়তা নীতিতে যেমন বলা আছে। প্ল্যান শেষ হওয়ার পরও যেকোনো সময় এক্সপোর্ট করতে পারবেন।",
        ],
        [
          "You're responsible for having the right to collect your customers' details and for using them lawfully, for example not sending messages they didn't agree to receive.",
          "কাস্টমারের তথ্য সংগ্রহের অধিকার আপনার আছে কি না এবং আইন মেনে ব্যবহার করছেন কি না, সে দায় আপনার। যেমন, কাস্টমার যে মেসেজ পেতে রাজি হননি তা পাঠাবেন না।",
        ],
      ],
    },
    {
      id: "use",
      title: ["Fair use", "যেভাবে ব্যবহার করা যাবে না"],
      short: ["No illegal goods, fraud, spam or attacks.", "অবৈধ পণ্য, প্রতারণা, স্প্যাম বা হামলা চলবে না।"],
      body: [
        ["Don't use HaatKhata to:", "হাটখাতা দিয়ে এগুলো করা যাবে না:"],
        {
          list: [
            ["sell goods or services that are illegal in Bangladesh;", "বাংলাদেশে অবৈধ পণ্য বা সেবা বিক্রি;"],
            ["deceive customers, couriers or payment providers;", "কাস্টমার, কুরিয়ার বা পেমেন্ট প্রতিষ্ঠানকে প্রতারণা;"],
            ["send spam or bulk messages people didn't ask for;", "অনাকাঙ্ক্ষিত স্প্যাম বা বাল্ক মেসেজ পাঠানো;"],
            ["break into, overload or copy the service, or resell it without our written permission.", "সেবায় অনুপ্রবেশ, অতিরিক্ত চাপ দেওয়া, কপি করা, বা লিখিত অনুমতি ছাড়া পুনরায় বিক্রি।"],
          ],
        },
        [
          "We may suspend an account that does these things. Where we can, we'll warn you first and tell you why.",
          "এসব করলে আমরা অ্যাকাউন্ট স্থগিত করতে পারি। সম্ভব হলে আগে সতর্ক করব এবং কারণ জানাব।",
        ],
      ],
    },
    {
      id: "connected",
      title: ["Couriers, payments and other services", "কুরিয়ার, পেমেন্ট ও অন্যান্য সেবা"],
      short: ["Connected services have their own terms. Risk scores are guides.", "যুক্ত সেবাগুলোর নিজস্ব শর্ত আছে। রিস্ক স্কোর শুধু সহায়ক।"],
      body: [
        [
          "When you connect a courier, payment gateway, Facebook, Instagram or WhatsApp, HaatKhata passes your instructions to them. Their own terms apply, and we aren't responsible for their deliveries, fees, outages or the money they hold for you.",
          "কুরিয়ার, পেমেন্ট গেটওয়ে, ফেসবুক, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ যুক্ত করলে হাটখাতা আপনার নির্দেশ তাদের কাছে পৌঁছে দেয়। তাদের নিজস্ব শর্ত প্রযোজ্য, এবং তাদের ডেলিভারি, চার্জ, সেবা বন্ধ থাকা বা আপনার যে টাকা তাদের কাছে আছে, তার দায় আমাদের নয়।",
        ],
        [
          "Return-risk scores and AI order reading help you decide faster, but they can be wrong. Check an order before you act on it.",
          "রিটার্ন-রিস্ক স্কোর আর AI দিয়ে অর্ডার পড়া দ্রুত সিদ্ধান্ত নিতে সাহায্য করে, কিন্তু ভুল হতে পারে। কাজ করার আগে অর্ডারটি যাচাই করুন।",
        ],
      ],
    },
    {
      id: "availability",
      title: ["Availability and offline use", "সেবা চালু থাকা ও অফলাইন ব্যবহার"],
      short: ["Offline entries live on your device until they sync.", "অফলাইনে তোলা তথ্য সিঙ্ক হওয়া পর্যন্ত ফোনেই থাকে।"],
      body: [
        [
          "We work to keep HaatKhata running at all times and back the server up every night, but we can't promise it will never be interrupted.",
          "আমরা হাটখাতা সবসময় চালু রাখার চেষ্টা করি এবং প্রতি রাতে সার্ভারের ব্যাকআপ নিই, তবে কখনো বিঘ্ন হবে না এমন নিশ্চয়তা দিতে পারি না।",
        ],
        [
          "Anything entered offline is saved on that device and sent when it's back online. Clearing the browser's data, or losing the device, before it syncs can lose those entries.",
          "অফলাইনে যা তোলা হয় তা ওই ডিভাইসেই সেভ থাকে, নেট ফিরলে পাঠানো হয়। সিঙ্ক হওয়ার আগে ব্রাউজারের ডেটা মুছে ফেললে বা ডিভাইস হারালে সেই তথ্য হারিয়ে যেতে পারে।",
        ],
      ],
    },
    {
      id: "liability",
      title: ["Limits of our liability", "আমাদের দায়ের সীমা"],
      short: ["At most, what you paid us in the last 3 months.", "সর্বোচ্চ, গত ৩ মাসে আমাদের যা পরিশোধ করেছেন।"],
      body: [
        [
          "HaatKhata is provided as it is. As far as the law allows, we aren't liable for indirect losses such as lost sales, lost profit, or mistakes in data you or your staff entered. Our total liability for any claim is limited to what you paid us in the 3 months before it.",
          "হাটখাতা যেমন আছে তেমনভাবে দেওয়া হয়। আইন যতটা অনুমতি দেয়, পরোক্ষ ক্ষতির (যেমন বিক্রি বা লাভ হারানো, বা আপনার বা স্টাফের তোলা তথ্যের ভুল) দায় আমাদের নয়। যেকোনো দাবিতে আমাদের মোট দায়, দাবির আগের ৩ মাসে আপনি আমাদের যা পরিশোধ করেছেন তার মধ্যে সীমিত।",
        ],
      ],
    },
    {
      id: "ending",
      title: ["Stopping and changes", "বন্ধ করা ও পরিবর্তন"],
      short: ["Stop any time by not renewing. Bangladeshi law applies.", "রিনিউ না করলেই বন্ধ। বাংলাদেশের আইন প্রযোজ্য।"],
      body: [
        [
          "You can stop using HaatKhata at any time by not renewing. To have your account and data deleted, contact us as described in the Privacy Policy.",
          "রিনিউ না করে যেকোনো সময় হাটখাতা ব্যবহার বন্ধ করতে পারেন। অ্যাকাউন্ট ও তথ্য মুছতে চাইলে গোপনীয়তা নীতিতে বলা উপায়ে যোগাযোগ করুন।",
        ],
        [
          "We may update these terms. The date at the top shows the latest version, and we'll tell you in the app before an important change takes effect.",
          "আমরা এই শর্তাবলী হালনাগাদ করতে পারি। ওপরের তারিখ সর্বশেষ সংস্করণ দেখায়, আর গুরুত্বপূর্ণ পরিবর্তন কার্যকর হওয়ার আগে অ্যাপে জানাব।",
        ],
        [
          "These terms are governed by the laws of Bangladesh, and the courts of Dhaka will hear any dispute.",
          "এই শর্তাবলী বাংলাদেশের আইন অনুযায়ী পরিচালিত, এবং যেকোনো বিরোধ ঢাকার আদালতে নিষ্পত্তি হবে।",
        ],
      ],
    },
  ],
};

const PRIVACY: LegalDoc = {
  title: ["Privacy Policy", "গোপনীয়তা নীতি"],
  intro: [
    `This policy explains what ${WHO} collects when you use HaatKhata, and what happens to it. It covers two groups: sellers who use HaatKhata, and their customers, whose details sellers enter. For customers' details, the seller decides what to collect, and we store and process it on the seller's behalf.`,
    `হাটখাতা ব্যবহারের সময় ${WHO} কী তথ্য সংগ্রহ করে আর তার কী হয়, এই নীতিতে তা বলা আছে। এখানে দুই দলের কথা: যে বিক্রেতারা হাটখাতা ব্যবহার করেন, আর তাদের কাস্টমার, যাদের তথ্য বিক্রেতা তোলেন। কাস্টমারের কোন তথ্য নেওয়া হবে তা বিক্রেতা ঠিক করেন; আমরা বিক্রেতার পক্ষে তা রাখি ও প্রক্রিয়া করি।`,
  ],
  sections: [
    {
      id: "collect",
      title: ["What we collect", "আমরা কী সংগ্রহ করি"],
      short: ["What you enter, plus what's needed to sign in and bill you.", "আপনি যা তোলেন, আর সাইন ইন ও বিলিংয়ের জন্য যা লাগে।"],
      body: [
        {
          list: [
            ["Account: your mobile number, name, shop name, logo and address, and your staff's numbers.", "অ্যাকাউন্ট: আপনার মোবাইল নম্বর, নাম, দোকানের নাম, লোগো ও ঠিকানা, আর স্টাফদের নম্বর।"],
            ["Business records: products, stock, prices, orders, suppliers, expenses and payments you record.", "ব্যবসার হিসাব: প্রোডাক্ট, স্টক, দাম, অর্ডার, সাপ্লায়ার, খরচ ও পেমেন্ট, যা আপনি তোলেন।"],
            ["Your customers: name, phone, delivery address, order history and any notes you add.", "আপনার কাস্টমার: নাম, ফোন, ডেলিভারির ঠিকানা, অর্ডারের ইতিহাস ও আপনার নোট।"],
            ["Payments to HaatKhata: plan, amount and the bKash or gateway transaction ID. We never see your PIN or card number.", "হাটখাতার পেমেন্ট: প্ল্যান, টাকার পরিমাণ আর বিকাশ বা গেটওয়ের ট্রানজেকশন আইডি। আপনার পিন বা কার্ড নম্বর আমরা কখনো দেখি না।"],
            ["Messages, if you connect Messenger, Instagram or WhatsApp: the conversations and contact details those apps send us.", "মেসেজ, যদি মেসেঞ্জার, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ যুক্ত করেন: ওই অ্যাপগুলো যে কথোপকথন ও যোগাযোগের তথ্য পাঠায়।"],
            ["Technical: IP address, browser type, sign-in times, error logs, a sign-in cookie, and a device cookie that counts trial prints.", "প্রযুক্তিগত: আইপি ঠিকানা, ব্রাউজারের ধরন, সাইন-ইনের সময়, এরর লগ, একটি সাইন-ইন কুকি, আর ট্রায়ালের প্রিন্ট গোনার জন্য একটি ডিভাইস কুকি।"],
          ],
        },
      ],
    },
    {
      id: "device",
      title: ["What stays on your device", "আপনার ডিভাইসে যা থাকে"],
      short: ["A copy of your shop lives in the browser so it works offline.", "অফলাইনে চালাতে দোকানের একটা কপি ব্রাউজারে থাকে।"],
      body: [
        [
          "HaatKhata keeps a copy of your shop's data in the browser's storage, so it opens fast and works offline. Preferences such as language, theme and printer paper stay only on that device.",
          "দ্রুত খুলতে ও অফলাইনে চলতে হাটখাতা দোকানের তথ্যের একটা কপি ব্রাউজারের স্টোরেজে রাখে। ভাষা, থিম, প্রিন্টারের কাগজের মতো পছন্দগুলো শুধু ওই ডিভাইসেই থাকে।",
        ],
        [
          "Anyone using that unlocked device can see this copy. Use the PIN lock on shared counter devices, and sign out of devices that aren't yours.",
          "ডিভাইসটি খোলা অবস্থায় যে ব্যবহার করবে সে এই কপি দেখতে পারবে। দোকানের শেয়ার করা ডিভাইসে পিন লক ব্যবহার করুন, আর অন্যের ডিভাইস থেকে সাইন আউট করুন।",
        ],
      ],
    },
    {
      id: "use",
      title: ["How we use it", "আমরা কীভাবে ব্যবহার করি"],
      short: ["Only to run HaatKhata. No ads, no selling data, no trackers.", "শুধু হাটখাতা চালাতে। বিজ্ঞাপন নেই, তথ্য বিক্রি নেই, ট্র্যাকার নেই।"],
      body: [
        [
          "We use this information to run HaatKhata for you: syncing your devices, printing, booking couriers, sending the SMS you ask for, keeping sign-in secure, billing, counting trial prints, answering support requests and fixing problems. We send service messages such as sign-in codes, renewal reminders and the summaries you turn on.",
          "এই তথ্য আমরা আপনার জন্য হাটখাতা চালাতে ব্যবহার করি: ডিভাইস সিঙ্ক, প্রিন্ট, কুরিয়ার বুকিং, আপনার চাওয়া SMS পাঠানো, নিরাপদ সাইন ইন, বিলিং, ট্রায়ালের প্রিন্ট গোনা, সাপোর্ট ও সমস্যা সমাধান। সাইন-ইন কোড, রিনিউয়ের রিমাইন্ডার আর আপনার চালু করা সারাংশের মতো সেবা-বার্তা পাঠাই।",
        ],
        [
          "We don't sell your data, we don't show ads, and HaatKhata has no third-party advertising or analytics trackers.",
          "আমরা আপনার তথ্য বিক্রি করি না, বিজ্ঞাপন দেখাই না, আর হাটখাতায় তৃতীয় পক্ষের কোনো বিজ্ঞাপন বা অ্যানালিটিক্স ট্র্যাকার নেই।",
        ],
      ],
    },
    {
      id: "risk",
      title: ["The return-risk network", "রিটার্ন-রিস্ক নেটওয়ার্ক"],
      short: ["Shops share only anonymous delivered/returned counts.", "দোকানগুলো শুধু নামহীন ডেলিভারি/ফেরতের সংখ্যা শেয়ার করে।"],
      body: [
        [
          "When you look up a customer's phone number, HaatKhata shows how many orders to that number were delivered, returned or cancelled: in your shop, and as anonymous totals across other HaatKhata shops.",
          "কাস্টমারের ফোন নম্বর খুঁজলে হাটখাতা দেখায় ওই নম্বরে কতগুলো অর্ডার ডেলিভারি, ফেরত বা বাতিল হয়েছে: আপনার দোকানে, আর অন্যান্য হাটখাতা দোকান মিলিয়ে নামহীন মোট সংখ্যা হিসেবে।",
        ],
        [
          "Other shops see only those totals from your orders. They never see your shop's name, your customer's name or address, or what was bought.",
          "অন্য দোকান আপনার অর্ডার থেকে শুধু ওই মোট সংখ্যাগুলো দেখে। আপনার দোকানের নাম, কাস্টমারের নাম বা ঠিকানা, বা কী কেনা হয়েছে, তারা কখনো দেখে না।",
        ],
      ],
    },
    {
      id: "share",
      title: ["Who we share it with", "কার সাথে শেয়ার করি"],
      short: ["Only services that help run HaatKhata, and only what each needs.", "শুধু হাটখাতা চালাতে সাহায্যকারী সেবা, আর শুধু যতটুকু দরকার।"],
      body: [
        ["We share information only with these services, and only what each one needs:", "শুধু এই সেবাগুলোর সাথে, আর প্রত্যেকের যতটুকু দরকার ততটুকুই শেয়ার করি:"],
        {
          list: [
            ["Couriers you connect (such as Steadfast, Pathao, RedX, Paperfly, Carrybee): the recipient's name, phone and address, the COD amount and parcel details for bookings you make.", "আপনার যুক্ত করা কুরিয়ার (যেমন স্টেডফাস্ট, পাঠাও, রেডএক্স, পেপারফ্লাই, ক্যারিবি): আপনার বুকিংয়ের প্রাপকের নাম, ফোন ও ঠিকানা, COD-এর পরিমাণ ও পার্সেলের তথ্য।"],
            ["Payment providers (bKash, Nagad, SSLCommerz): the amount and a payment reference.", "পেমেন্ট প্রতিষ্ঠান (বিকাশ, নগদ, SSLCommerz): টাকার পরিমাণ ও পেমেন্টের রেফারেন্স।"],
            ["Our SMS gateway: the phone number and the message text.", "আমাদের SMS গেটওয়ে: ফোন নম্বর ও মেসেজের লেখা।"],
            ["Meta (Facebook, Instagram, WhatsApp), if you connect them: the replies you send from the inbox.", "মেটা (ফেসবুক, ইনস্টাগ্রাম, হোয়াটসঅ্যাপ), যুক্ত করলে: ইনবক্স থেকে পাঠানো আপনার উত্তর।"],
            ["Anthropic (Claude AI): when you paste a chat to create an order and our built-in reader misses something, the message text and your product names may be sent to Anthropic's AI to fill the gap. Under Anthropic's commercial terms, this data isn't used to train their models.", "Anthropic (Claude AI): চ্যাট পেস্ট করে অর্ডার বানানোর সময় আমাদের নিজস্ব রিডার কিছু ধরতে না পারলে, মেসেজের লেখা ও আপনার প্রোডাক্টের নাম ঘাটতি পূরণে Anthropic-এর AI-তে পাঠানো হতে পারে। Anthropic-এর বাণিজ্যিক শর্ত অনুযায়ী এই তথ্য তাদের মডেল প্রশিক্ষণে ব্যবহার হয় না।"],
            ["Hosting: our server provider, and Cloudflare for network security, delivery, and storage of backups and uploaded images.", "হোস্টিং: আমাদের সার্ভার প্রদানকারী, আর নেটওয়ার্ক নিরাপত্তা, ডেলিভারি এবং ব্যাকআপ ও আপলোড করা ছবি রাখার জন্য Cloudflare।"],
            ["Browser push services (Google, Apple, Mozilla), to deliver notifications you turn on.", "ব্রাউজারের পুশ সেবা (গুগল, অ্যাপল, মোজিলা), আপনার চালু করা নোটিফিকেশন পৌঁছাতে।"],
            ["Authorities, when Bangladeshi law requires it.", "কর্তৃপক্ষ, যখন বাংলাদেশের আইন তা বাধ্যতামূলক করে।"],
          ],
        },
      ],
    },
    {
      id: "security",
      title: ["How we protect it", "কীভাবে সুরক্ষিত রাখি"],
      short: ["Encrypted connections and keys, shops kept apart.", "এনক্রিপ্টেড সংযোগ ও কী, প্রতিটা দোকান আলাদা।"],
      body: [
        {
          list: [
            ["Every connection uses HTTPS.", "প্রতিটা সংযোগ HTTPS-এ।"],
            ["Each shop's data is kept apart in the database, so one shop can't read another's.", "ডেটাবেসে প্রতিটা দোকানের তথ্য আলাদা রাখা হয়, তাই এক দোকান অন্যটির তথ্য পড়তে পারে না।"],
            ["Courier and payment keys you save are stored encrypted.", "আপনার সেভ করা কুরিয়ার ও পেমেন্টের কী এনক্রিপ্ট করে রাখা হয়।"],
            ["Staff see only what their role allows. Sales staff never see buying prices or profit.", "স্টাফ শুধু তার রোলে যা অনুমতি আছে তা-ই দেখে। সেলস স্টাফ কখনো কেনা দাম বা লাভ দেখে না।"],
            ["Sign-in codes expire after 5 minutes.", "সাইন-ইন কোডের মেয়াদ ৫ মিনিট।"],
          ],
        },
      ],
    },
    {
      id: "keep",
      title: ["How long we keep it", "কতদিন রাখি"],
      short: ["While your account exists. Deleted within 30 days on request.", "অ্যাকাউন্ট থাকা পর্যন্ত। অনুরোধ করলে ৩০ দিনের মধ্যে মুছে ফেলা হয়।"],
      body: [
        [
          "We keep your data while your account exists, including after a plan ends, so you can come back to it.",
          "অ্যাকাউন্ট থাকা পর্যন্ত, প্ল্যান শেষ হওয়ার পরও, আমরা তথ্য রাখি, যাতে আপনি ফিরে এসে পান।",
        ],
        [
          "If you ask us to delete your account, we remove your shop's data from the live server within 30 days, and nightly backups age out 14 days after that. We keep payment records and VAT receipts for as long as the law requires. Anonymous return-risk totals can't be traced back to you and may remain.",
          "অ্যাকাউন্ট মুছতে বললে ৩০ দিনের মধ্যে লাইভ সার্ভার থেকে দোকানের তথ্য সরিয়ে ফেলি, আর তার ১৪ দিন পর রাতের ব্যাকআপ থেকেও মুছে যায়। আইন যতদিন চায় ততদিন পেমেন্টের রেকর্ড ও ভ্যাট রসিদ রাখি। নামহীন রিটার্ন-রিস্ক সংখ্যা আপনার সাথে মেলানো যায় না, তাই থেকে যেতে পারে।",
        ],
      ],
    },
    {
      id: "choices",
      title: ["Your choices and rights", "আপনার পছন্দ ও অধিকার"],
      short: ["See, correct, export or delete. Customers: ask the shop first.", "দেখুন, ঠিক করুন, এক্সপোর্ট বা মুছুন। কাস্টমার: আগে দোকানকে বলুন।"],
      body: [
        [
          `You can see, correct and export your data in the app at any time, turn summaries and notifications off, and disconnect couriers or Meta in Settings. To delete your account, email ${MAIL} or call us from the owner's phone number.`,
          `অ্যাপে যেকোনো সময় তথ্য দেখতে, ঠিক করতে ও এক্সপোর্ট করতে পারেন, সারাংশ ও নোটিফিকেশন বন্ধ করতে পারেন, আর সেটিংসে কুরিয়ার বা মেটা বিচ্ছিন্ন করতে পারেন। অ্যাকাউন্ট মুছতে মালিকের ফোন নম্বর থেকে কল করুন বা ${MAIL}-এ ইমেইল করুন।`,
        ],
        [
          "If you're a customer of a shop that uses HaatKhata, contact that shop first, because it controls your details. We'll help it answer you, and you can also contact us.",
          "আপনি যদি হাটখাতা ব্যবহারকারী কোনো দোকানের কাস্টমার হন, আগে ওই দোকানে যোগাযোগ করুন, কারণ আপনার তথ্য তারাই নিয়ন্ত্রণ করে। উত্তর দিতে আমরা তাদের সাহায্য করব, আর আপনি আমাদেরও জানাতে পারেন।",
        ],
        [
          "HaatKhata accounts are for people aged 18 or over. We'll update this policy as the service changes, and the date at the top shows the latest version.",
          "হাটখাতা অ্যাকাউন্ট ১৮ বছর বা তার বেশি বয়সীদের জন্য। সেবা বদলালে এই নীতি হালনাগাদ করব; ওপরের তারিখ সর্বশেষ সংস্করণ দেখায়।",
        ],
      ],
    },
  ],
};

const REFUND: LegalDoc = {
  title: ["Refund Policy", "রিফান্ড নীতি"],
  intro: [
    "You can try every Business feature for 7 days before paying, so you know what you're buying. After that, these are the cases where we refund a payment.",
    "পেমেন্টের আগে ৭ দিন বিজনেস প্ল্যানের সব সুবিধা চালিয়ে দেখতে পারেন, তাই কী কিনছেন তা জেনেই কেনেন। তারপর যেসব ক্ষেত্রে আমরা টাকা ফেরত দিই, তা নিচে দেওয়া হলো।",
  ],
  sections: [
    {
      id: "full",
      title: ["Full refunds", "পুরো টাকা ফেরত"],
      short: ["Charged twice, or paid and the plan never started.", "দুবার টাকা কাটলে, বা টাকা দিয়েও প্ল্যান চালু না হলে।"],
      body: [
        ["We refund the full amount when:", "এসব ক্ষেত্রে পুরো টাকা ফেরত দিই:"],
        {
          list: [
            ["you were charged twice for the same plan and period (we refund the extra payment);", "একই প্ল্যান ও সময়ের জন্য দুবার টাকা কাটা হলে (বাড়তি পেমেন্টটি ফেরত);"],
            ["you paid but your plan wasn't activated, and we can't fix it within 2 working days.", "টাকা দিয়েছেন কিন্তু প্ল্যান চালু হয়নি, এবং ২ কার্যদিবসের মধ্যে আমরা ঠিক করতে পারিনি।"],
          ],
        },
        ["Ask within 30 days of the payment.", "পেমেন্টের ৩০ দিনের মধ্যে জানাতে হবে।"],
      ],
    },
    {
      id: "yearly",
      title: ["Yearly plans", "বার্ষিক প্ল্যান"],
      short: ["Changed your mind within 7 days? We keep one month.", "৭ দিনের মধ্যে মত বদলালে? এক মাসের দাম রেখে বাকিটা ফেরত।"],
      body: [
        [
          "If you pay for a year and change your mind within 7 days of paying, we refund the payment minus one month at that plan's monthly price.",
          "এক বছরের জন্য পেমেন্ট করে ৭ দিনের মধ্যে মত বদলালে, ওই প্ল্যানের এক মাসের দাম রেখে বাকি টাকা ফেরত দিই।",
        ],
      ],
    },
    {
      id: "not",
      title: ["What we don't refund", "যা ফেরত হয় না"],
      short: ["Monthly or quarterly time once started, and used credits.", "শুরু হওয়া মাসিক বা ত্রৈমাসিক সময়, আর ব্যবহৃত ক্রেডিট।"],
      body: [
        {
          list: [
            ["Monthly and three-month payments once the plan has started.", "প্ল্যান শুরু হওয়ার পর মাসিক ও তিন মাসের পেমেন্ট।"],
            ["Time left on a plan when you stop using HaatKhata or move to a smaller plan. A smaller plan starts from your next payment.", "হাটখাতা ব্যবহার বন্ধ করলে বা ছোট প্ল্যানে গেলে প্ল্যানের বাকি সময়। ছোট প্ল্যান শুরু হয় পরের পেমেন্ট থেকে।"],
            ["SMS credits, once bought.", "কেনা SMS ক্রেডিট।"],
            ["Payments for a shop suspended for breaking the Terms of Service.", "শর্তাবলী ভাঙার কারণে স্থগিত দোকানের পেমেন্ট।"],
          ],
        },
      ],
    },
    {
      id: "how",
      title: ["How to ask, and how you're paid back", "কীভাবে চাইবেন, কীভাবে ফেরত পাবেন"],
      short: ["Send the transaction ID; money returns to the same wallet.", "ট্রানজেকশন আইডি পাঠান; টাকা একই ওয়ালেটে ফেরত যায়।"],
      body: [
        [
          `Contact us from the shop owner's phone number, or email ${MAIL}, with the bKash (or other) transaction ID shown on your HaatKhata receipt.`,
          `দোকানের মালিকের ফোন নম্বর থেকে যোগাযোগ করুন, বা ${MAIL}-এ ইমেইল করুন, সাথে হাটখাতার রসিদে থাকা বিকাশ (বা অন্য) ট্রানজেকশন আইডি দিন।`,
        ],
        [
          "We reply within 2 working days. Once a refund is approved, we send it within 3 working days to the same bKash wallet, or other method, you paid from. bKash or your bank may take up to 7 more working days to show it.",
          "২ কার্যদিবসের মধ্যে উত্তর দিই। রিফান্ড অনুমোদন হলে ৩ কার্যদিবসের মধ্যে যে বিকাশ ওয়ালেট বা মাধ্যম থেকে পেমেন্ট করেছিলেন সেখানেই পাঠাই। বিকাশ বা ব্যাংকে তা দেখাতে আরও ৭ কার্যদিবস পর্যন্ত লাগতে পারে।",
        ],
      ],
    },
    {
      id: "cancel",
      title: ["Cancelling", "বাতিল করা"],
      short: ["Nothing renews by itself, so just don't renew.", "নিজে থেকে কিছু রিনিউ হয় না, তাই শুধু রিনিউ করবেন না।"],
      body: [
        [
          "Plans never renew automatically, so there's nothing to cancel: if you don't pay again, the plan ends at the end of the time you paid for. Your data stays readable and exportable.",
          "প্ল্যান কখনো নিজে থেকে রিনিউ হয় না, তাই বাতিল করার কিছু নেই: আবার পেমেন্ট না করলে পরিশোধিত সময় শেষে প্ল্যান শেষ হয়। আপনার তথ্য দেখা ও এক্সপোর্ট করা যাবে।",
        ],
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = { terms: TERMS, privacy: PRIVACY, refund: REFUND };
