export const mockBilling = {
  plan: "Starter",
  monthlyPrice: 29,
  nextInvoice: "2026-10-01",
  used: 12,
  limit: 50,
  payment: "Visa •••• 4242",
  invoices: [
    {
      number: "DEMO-2026-009",
      date: "2026-09-01",
      amount: 29,
      status: "Betaald",
    },
    {
      number: "DEMO-2026-008",
      date: "2026-08-01",
      amount: 29,
      status: "Betaald",
    },
    {
      number: "DEMO-2026-007",
      date: "2026-07-01",
      amount: 29,
      status: "Betaald",
    },
  ],
};
export const euro = (amount: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    amount,
  );
export const invoiceDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
