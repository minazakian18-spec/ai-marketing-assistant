import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import "../marketing.css";
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mkt">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
