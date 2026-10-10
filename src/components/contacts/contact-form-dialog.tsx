"use client";
import { useEffect, useId, useState } from "react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type { Contact, ContactStatus } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactFormDialog({
  open,
  contact,
  groups,
  existingEmails,
  onClose,
  onSave,
}: {
  open: boolean;
  contact?: Contact | null;
  groups: string[];
  existingEmails: string[];
  onClose: () => void;
  onSave: (contact: Contact) => void;
}) {
  const listId = useId();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState<ContactStatus>("Niet bevestigd");
  const [error, setError] = useState("");
  // Someone who unsubscribed can only opt in again themselves (signup form).
  const optedOut = contact?.newsletter?.status === "unsubscribed";
  useEffect(() => {
    if (!open) return;
    setFirstName(contact?.firstName || "");
    setLastName(contact?.lastName || "");
    setEmail(contact?.email || "");
    setPhone(contact?.phone || "");
    setCompany(contact?.company || "");
    setGroup(contact?.group || "");
    setStatus(contact?.status || "Niet bevestigd");
    setError("");
  }, [open, contact]);
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={contact ? "Contact bewerken" : "Contact toevoegen"}
      confirmLabel={contact ? "Wijzigingen opslaan" : "Contact toevoegen"}
      onConfirm={async () => {
        const trimmedEmail = email.trim();
        if (!EMAIL_RE.test(trimmedEmail)) {
          setError("Vul een geldig e-mailadres in.");
          return;
        }
        if (existingEmails.includes(trimmedEmail.toLowerCase())) {
          setError("Dit e-mailadres staat al in je contacten.");
          return;
        }
        await onSave({
          ...contact,
          id: contact?.id || crypto.randomUUID(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          group: group.trim() || undefined,
          status,
          source: contact?.source || "manual",
          createdAt: contact?.createdAt || new Date().toISOString(),
        });
      }}
    >
      <div className="ig-two-fields">
        <label>
          Voornaam
          <input
            value={firstName}
            maxLength={80}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label>
          Achternaam
          <input
            value={lastName}
            maxLength={80}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>
      </div>
      <label>
        E-mailadres
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
        />
      </label>
      {error && <p className="field-error">{error}</p>}
      <div className="ig-two-fields">
        <label>
          Telefoonnummer (optioneel)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Bedrijf (optioneel)
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>
      <label>
        Tag / groep (optioneel)
        <input
          value={group}
          list={listId}
          maxLength={60}
          placeholder="Bijv. Klanten, Leads, VIP klanten"
          onChange={(e) => setGroup(e.target.value)}
        />
        <datalist id={listId}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label>
        Toestemming voor e-mailmarketing
        <select value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
          <option value="Ingeschreven" disabled={optedOut && contact?.status !== "Ingeschreven"}>
            Ingeschreven: heeft toestemming gegeven
          </option>
          <option value="Niet bevestigd">Niet bevestigd: nog geen toestemming</option>
          <option value="Uitgeschreven">Uitgeschreven: wil geen nieuwsbrief</option>
        </select>
      </label>
      <p className="field-note">
        {optedOut
          ? "Dit contact heeft zich afgemeld. Alleen de persoon zelf kan zich opnieuw aanmelden via je aanmeldformulier."
          : "Kies alleen Ingeschreven als deze persoon zelf toestemming heeft gegeven. Een klant of iemand die je mailt heeft dat niet automatisch."}
      </p>
    </ConfirmDialog>
  );
}
