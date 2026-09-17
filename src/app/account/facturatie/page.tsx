"use client";
import Link from "next/link";
import { Download, CreditCard } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import { mockBilling, euro, invoiceDate } from "@/lib/mock-billing";
import { downloadFile } from "@/lib/download";
export default function BillingPage() {
  const { data } = useWorkspace();
  const [message, setMessage] = useState("");
  const { profile } = data;
  function download(invoice: (typeof mockBilling.invoices)[number]) {
    try {
      downloadFile(
        invoice.number + ".txt",
        [
          "DEMOFACTUUR — GEEN GELDIGE FACTUUR",
          "Mavix",
          "Factuurnummer: " + invoice.number,
          "Datum: " + invoiceDate(invoice.date),
          "Abonnement: " + mockBilling.plan,
          "Bedrag: " + euro(invoice.amount) + " per maand (fictief)",
          "Status: " + invoice.status,
          "Dit is een voorbeeldbestand. Er is geen betaling uitgevoerd.",
        ].join("\n"),
        "text/plain;charset=utf-8",
      );
      setMessage("Voorbeeldfactuur gedownload als tekstbestand.");
    } catch {
      setMessage("Downloaden is niet gelukt. Probeer opnieuw.");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="JOUW ABONNEMENT"
        title="Facturatie"
        description="Je abonnement, betaalgegevens en facturen op één plek."
      />
      <div className="demo-notice">
        <span className="badge draft">Mockdata</span>Alle bedragen, datums,
        limieten en betalingen hieronder zijn fictief.
      </div>
      <div className="billing-grid">
        <section className="panel account-panel">
          <div className="section-heading">
            <h2>Huidig abonnement</h2>
            <span className="badge scheduled">Demo</span>
          </div>
          <div className="account-panel-body">
            <h3 className="plan-name">{mockBilling.plan}</h3>
            <p className="plan-price">
              {euro(mockBilling.monthlyPrice)}
              <span> / maand</span>
            </p>
            <dl className="settings-details">
              <div>
                <dt>Volgende factuurdatum</dt>
                <dd>{invoiceDate(mockBilling.nextInvoice)}</dd>
              </div>
              <div>
                <dt>Gebruik / limieten</dt>
                <dd>
                  {mockBilling.used} van {mockBilling.limit} posts
                </dd>
              </div>
            </dl>
            <progress
              aria-label="Voorbeeldgebruik: 12 van 50 posts"
              max={mockBilling.limit}
              value={mockBilling.used}
            />
            <p className="field-note">
              Voorbeeldgebruik per maand, los van je lokale content.
            </p>
          </div>
        </section>
        <section className="panel account-panel">
          <div className="section-heading">
            <h2>Betaalgegevens</h2>
            <CreditCard size={20} />
          </div>
          <div className="account-panel-body">
            <dl className="settings-details">
              <div>
                <dt>Betaalmethode</dt>
                <dd>
                  {mockBilling.payment}{" "}
                  <span className="field-note">(demo)</span>
                </dd>
              </div>
              <div>
                <dt>Factuuradres</dt>
                <dd>
                  {profile.name || "Nog geen bedrijfsnaam"}
                  <br />
                  {profile.address || "Nog geen adres"}
                  <br />
                  {[profile.postalCode, profile.city]
                    .filter(Boolean)
                    .join(" ") || "Postcode en plaats ontbreken"}
                  {profile.country && (
                    <>
                      <br />
                      {profile.country}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>BTW-nummer</dt>
                <dd>{profile.vatNumber || "Nog niet ingevuld"}</dd>
              </div>
            </dl>
            <Link className="text-link" href="/account">
              Bedrijfsgegevens aanpassen →
            </Link>
            <p className="field-note billing-address-note">
              Het factuuradres en BTW-nummer gebruiken je opgeslagen
              bedrijfsgegevens.
            </p>
          </div>
        </section>
      </div>
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>Overzicht van facturen</h2>
            <p>Download een voorbeeldfactuur als tekstbestand.</p>
          </div>
        </div>
        <div className="invoice-scroll">
          <table className="invoice-table">
            <caption className="sr-only">
              Fictieve facturen voor het Starter-abonnement
            </caption>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Factuurnummer</th>
                <th scope="col">Bedrag</th>
                <th scope="col">Status</th>
                <th scope="col">Download</th>
              </tr>
            </thead>
            <tbody>
              {mockBilling.invoices.map((invoice) => (
                <tr key={invoice.number}>
                  <td>{invoiceDate(invoice.date)}</td>
                  <td>{invoice.number}</td>
                  <td>{euro(invoice.amount)}</td>
                  <td>
                    <span className="badge approved">{invoice.status}</span>
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      aria-label={"Download voorbeeldfactuur " + invoice.number}
                      onClick={() => download(invoice)}
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p role="status" className="success-message">
        {message}
      </p>
    </>
  );
}
