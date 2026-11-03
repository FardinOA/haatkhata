import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Baloo_Da_2, Geist, Geist_Mono, Hind_Siliguri, Noto_Sans_Bengali } from "next/font/google";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap", preload: false });
const anek = Anek_Bangla({ variable: "--font-anek", subsets: ["latin", "bengali"], axes: ["wdth"], display: "swap" });
const notoBn = Noto_Sans_Bengali({ variable: "--font-noto-bn", subsets: ["bengali"], display: "swap", preload: false });
const hind = Hind_Siliguri({ variable: "--font-hind", subsets: ["latin", "bengali"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const baloo = Baloo_Da_2({ variable: "--font-baloo", subsets: ["latin", "bengali"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "BechaKena", template: "%s · BechaKena" },
  description: "Stock, sales and invoicing for online and social sellers.",
  applicationName: "BechaKena",
  icons: { apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "BechaKena", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F3F4F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-canvas="stone"
      data-density="comfortable"
      data-display="anek"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${anek.variable} ${notoBn.variable} ${hind.variable} ${baloo.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the seller's saved theme before first paint — no flash of default green. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
