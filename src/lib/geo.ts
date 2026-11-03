/** All 64 districts of Bangladesh, [English, Bangla]. */
export const DISTRICTS: [string, string][] = [
  ["Dhaka", "ঢাকা"], ["Gazipur", "গাজীপুর"], ["Narayanganj", "নারায়ণগঞ্জ"], ["Narsingdi", "নরসিংদী"],
  ["Manikganj", "মানিকগঞ্জ"], ["Munshiganj", "মুন্সীগঞ্জ"], ["Faridpur", "ফরিদপুর"], ["Gopalganj", "গোপালগঞ্জ"],
  ["Madaripur", "মাদারীপুর"], ["Rajbari", "রাজবাড়ী"], ["Shariatpur", "শরীয়তপুর"], ["Kishoreganj", "কিশোরগঞ্জ"],
  ["Tangail", "টাঙ্গাইল"], ["Chattogram", "চট্টগ্রাম"], ["Cox's Bazar", "কক্সবাজার"], ["Cumilla", "কুমিল্লা"],
  ["Brahmanbaria", "ব্রাহ্মণবাড়িয়া"], ["Chandpur", "চাঁদপুর"], ["Feni", "ফেনী"], ["Lakshmipur", "লক্ষ্মীপুর"],
  ["Noakhali", "নোয়াখালী"], ["Khagrachhari", "খাগড়াছড়ি"], ["Rangamati", "রাঙ্গামাটি"], ["Bandarban", "বান্দরবান"],
  ["Sylhet", "সিলেট"], ["Moulvibazar", "মৌলভীবাজার"], ["Habiganj", "হবিগঞ্জ"], ["Sunamganj", "সুনামগঞ্জ"],
  ["Rajshahi", "রাজশাহী"], ["Bogura", "বগুড়া"], ["Pabna", "পাবনা"], ["Sirajganj", "সিরাজগঞ্জ"],
  ["Natore", "নাটোর"], ["Naogaon", "নওগাঁ"], ["Chapainawabganj", "চাঁপাইনবাবগঞ্জ"], ["Joypurhat", "জয়পুরহাট"],
  ["Khulna", "খুলনা"], ["Jashore", "যশোর"], ["Satkhira", "সাতক্ষীরা"], ["Bagerhat", "বাগেরহাট"],
  ["Kushtia", "কুষ্টিয়া"], ["Jhenaidah", "ঝিনাইদহ"], ["Magura", "মাগুরা"], ["Narail", "নড়াইল"],
  ["Chuadanga", "চুয়াডাঙ্গা"], ["Meherpur", "মেহেরপুর"], ["Barishal", "বরিশাল"], ["Bhola", "ভোলা"],
  ["Patuakhali", "পটুয়াখালী"], ["Pirojpur", "পিরোজপুর"], ["Jhalokati", "ঝালকাঠি"], ["Barguna", "বরগুনা"],
  ["Rangpur", "রংপুর"], ["Dinajpur", "দিনাজপুর"], ["Kurigram", "কুড়িগ্রাম"], ["Gaibandha", "গাইবান্ধা"],
  ["Nilphamari", "নীলফামারী"], ["Lalmonirhat", "লালমনিরহাট"], ["Thakurgaon", "ঠাকুরগাঁও"], ["Panchagarh", "পঞ্চগড়"],
  ["Mymensingh", "ময়মনসিংহ"], ["Jamalpur", "জামালপুর"], ["Netrokona", "নেত্রকোনা"], ["Sherpur", "শেরপুর"],
];

/** Common Dhaka city areas — used for quick-pick and message parsing. */
export const DHAKA_AREAS = [
  "Mirpur", "Mirpur 1", "Mirpur 2", "Mirpur 10", "Mirpur 11", "Mirpur 12", "Pallabi", "Kafrul", "Uttara",
  "Uttara Sector 7", "Uttara Sector 11", "Dhanmondi", "Mohammadpur", "Lalmatia", "Shyamoli", "Adabor",
  "Gulshan", "Gulshan 1", "Gulshan 2", "Banani", "Baridhara", "Bashundhara", "Badda", "Rampura", "Banasree",
  "Khilgaon", "Malibagh", "Mogbazar", "Motijheel", "Paltan", "Shantinagar", "Farmgate", "Tejgaon", "Kawran Bazar",
  "Mohakhali", "Old Dhaka", "Lalbagh", "Wari", "Jatrabari", "Demra", "Keraniganj", "Savar", "Ashulia",
  "Azimpur", "New Market", "Elephant Road", "Kalabagan", "Khilkhet", "Nikunja", "Cantonment", "Hazaribagh",
];

export function isInsideDhaka(district: string) {
  return district.trim().toLowerCase() === "dhaka";
}

export function districtBn(en: string) {
  return DISTRICTS.find(([e]) => e === en)?.[1] ?? en;
}
