import type { Metadata } from "next";
import { AccountLayout } from "@/components/account/account-layout";
// The settings pages below keep the "| Mavix" suffix.
export const metadata: Metadata = { title: { absolute: "Account en profiel | Mavix", template: "%s | Mavix" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccountLayout>{children}</AccountLayout>;
}
