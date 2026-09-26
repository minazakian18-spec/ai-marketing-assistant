import "../marketing.css";
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mkt">{children}</div>;
}
