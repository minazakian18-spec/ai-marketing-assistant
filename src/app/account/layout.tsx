import { AccountLayout } from "@/components/account/account-layout";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccountLayout>{children}</AccountLayout>;
}
