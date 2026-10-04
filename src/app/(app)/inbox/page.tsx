"use client";
import Link from "next/link";
import { useState } from "react";
import { Inbox, MessageCircle, Instagram, Mail, Plug, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui";

const FILTERS = ["Alles", "WhatsApp", "Instagram", "Messenger", "E-mail"] as const;

// Planned channels. None of them can deliver messages yet (Gmail is only
// connected for sending), so the inbox stays empty rather than showing samples.
const CHANNELS = [
  { name: "WhatsApp Business", Icon: MessageCircle },
  { name: "Instagram DM", Icon: Instagram },
  { name: "Facebook Messenger", Icon: MessageCircle },
  { name: "Gmail", Icon: Mail },
];

export default function InboxPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Alles");
  return (
    <div className="inbox">
      <PageHeading
        eyebrow="Werkruimte"
        title="Inbox"
        description="Al je klantgesprekken op één plek."
      />
      <div className="inbox-filters" role="group" aria-label="Kanaal">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="inbox-layout panel">
        <aside className="inbox-list" aria-label="Gesprekken">
          <p className="inbox-list-empty">Geen gesprekken</p>
        </aside>
        <section className="inbox-thread">
          <div className="ws-empty">
            <span className="ws-empty-icon">
              <Inbox size={22} />
            </span>
            <h2>Nog geen kanalen gekoppeld</h2>
            <p>
              Verbind je communicatiekanalen om gesprekken hier samen te
              brengen.
            </p>
            <ul className="inbox-channels">
              {CHANNELS.map(({ name, Icon }) => (
                <li key={name}>
                  <Icon size={15} />
                  {name}
                  <span>Binnenkort</span>
                </li>
              ))}
            </ul>
            <Link className="button secondary" href="/account/integraties">
              <Plug size={15} />
              Naar Integraties
            </Link>
          </div>
        </section>
        <aside className="inbox-context" aria-label="Klantgegevens">
          <UserRound size={18} />
          <p>Selecteer een gesprek om klantgegevens te zien.</p>
        </aside>
      </div>
    </div>
  );
}
