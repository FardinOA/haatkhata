import { AuthFrame } from "@/components/auth/auth-frame";

// Like the app shell, these screens read the on-device store.
export const instant = false;

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthFrame>{children}</AuthFrame>;
}
