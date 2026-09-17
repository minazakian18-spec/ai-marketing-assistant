"use client";
import { useState } from "react";
import { PageHeading } from "@/components/ui";
import { contacts } from "@/lib/contact-data";
export default function ContactsPage() {
  const [group, setGroup] = useState("Alle groepen");
  return (
    <>
      <PageHeading
        eyebrow="KLANTEN & RESULTATEN"
        title="Contacten"
        description="Een overzicht van je contacten, groepen en e-mailstatus."
      />
      <div className="demo-notice">
        <span className="badge draft">Mockdata</span>Dit zijn fictieve
        contacten. Er worden geen gegevens geïmporteerd of e-mails verzonden.
      </div>
      <div className="contacts-filter">
        <label>
          Groep
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option>Alle groepen</option>
            <option>Nieuwsbrieflezers</option>
            <option>Vaste klanten</option>
          </select>
        </label>
      </div>
      <section className="panel">
        <div className="invoice-scroll">
          <table className="invoice-table contacts-table">
            <caption className="sr-only">Voorbeeldcontacten</caption>
            <thead>
              <tr>
                <th scope="col">Contact</th>
                <th scope="col">Groep</th>
                <th scope="col">Tags</th>
                <th scope="col">E-mailstatus</th>
              </tr>
            </thead>
            <tbody>
              {contacts
                .filter((c) => group === "Alle groepen" || c.group === group)
                .map((c) => (
                  <tr key={c.email}>
                    <td>
                      <strong>{c.name}</strong>
                      <p className="field-note">{c.email}</p>
                    </td>
                    <td>{c.group}</td>
                    <td>
                      <span className="badge scheduled">{c.tag}</span>
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (c.status === "Ingeschreven" ? "approved" : "draft")
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
