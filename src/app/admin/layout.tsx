import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";

export const instant = false;
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AuthFrame>{children}</AuthFrame>;
}
