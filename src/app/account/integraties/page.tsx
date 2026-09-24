"use client";
import { useState } from "react";
import {
  Instagram,
  Mail,
  Inbox,
  MapPin,
  Globe,
  Store,
  ShoppingCart,
  Plug,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type { Integrations } from "@/lib/types";

type Category = "social" | "google" | "email" | "web";
const integrations = [
  {
    key: "instagram",
    name: "Instagram / Meta",
    category: "social" as Category,
    Icon: Instagram,
    iconClass: "instagram",
    description: "Geef je Instagram-content een plek in je werkruimte.",
  },
  {
    key: "googleBusiness",
    name: "Google Business Profile",
    category: "google" as Category,
    Icon: MapPin,
    iconClass: "google",
    description: "Beheer en beantwoord je Google-reviews vanuit Mavix.",
  },
  {
    key: "email",
    name: "Gmail",
    category: "email" as Category,
    Icon: Mail,
    iconClass: "email",
    description: "Verstuur en beheer e-mailcampagnes via Gmail.",
  },
  {
    key: "outlook",
    name: "Outlook",
    category: "email" as Category,
    Icon: Inbox,
    iconClass: "outlook",
    description: "Verstuur en beheer e-mailcampagnes via Outlook.",
  },
  {
    key: "website",
    name: "Website",
    category: "web" as Category,
    Icon: Globe,
    iconClass: "website",
    description: "Gebruik informatie van je website in je content.",
  },
  {
    key: "shopify",
    name: "Shopify",
    category: "web" as Category,
    Icon: Store,
    iconClass: "shopify",
    description: "Haal producten en aanbiedingen op uit je Shopify-winkel.",
  },
  {
    key: "woocommerce",
    name: "WooCommerce",
    category: "web" as Category,
    Icon: ShoppingCart,
    iconClass: "woocommerce",
    description:
      "Haal producten en aanbiedingen op uit je WooCommerce-winkel.",
  },
] satisfies {
  key: keyof Integrations;
  name: string;
  category: Category;
  Icon: typeof Mail;
  iconClass: string;
  description: string;
}[];

const categoryFilters: [Category | "all", string][] = [
  ["all", "Alle"],
  ["social", "Social media"],
  ["email", "E-mail"],
  ["google", "Google"],
  ["web", "Website & e-commerce"],
];

export default function IntegrationsPage() {
  const { data, save } = useWorkspace();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [selected, setSelected] = useState<keyof Integrations | null>(null);
  const [message, setMessage] = useState("");
  const selectedIntegration = integrations.find((i) => i.key === selected);
  const connected = selected ? data.integrations[selected] : false;
  const visible =
    filter === "all"
      ? integrations
      : integrations.filter((i) => i.category === filter);
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE"
        title="Integraties"
        description="Verbind de tools die je al gebruikt met je Mavix-werkruimte."
      />
      <div className="demo-notice">
        <span className="badge draft">Demomodus</span>Je kunt de
        verbindingsstatus uitproberen. Er worden geen accounts gekoppeld of
        gegevens verstuurd.
      </div>
      <div
        className="lib-toolbar"
        role="group"
        aria-label="Filter op categorie"
      >
        {categoryFilters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="lib-filter-pill"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="integration-grid">
        {visible.map(({ key, name, Icon, iconClass, description }) => (
          <section className="panel integration-card" key={key}>
            <div className="integration-card-top">
              <span className={"integration-icon " + iconClass}>
                <Icon size={27} />
              </span>
              <span
                className={
                  "badge " + (data.integrations[key] ? "approved" : "draft")
                }
              >
                {data.integrations[key] && <span className="live-dot" />}
                {data.integrations[key] ? "Gekoppeld" : "Niet gekoppeld"}
              </span>
            </div>
            <h2>{name}</h2>
            <p>{description}</p>
            <span className="field-note">
              {data.integrations[key]
                ? "Gesimuleerde verbinding · alleen lokaal"
                : "Nog geen verbinding ingesteld"}
            </span>
            <button
              className={
                "button " + (data.integrations[key] ? "secondary" : "primary")
              }
              onClick={() => setSelected(key)}
            >
              {data.integrations[key] ? (
                <Check size={17} />
              ) : (
                <Plug size={17} />
              )}{" "}
              {data.integrations[key] ? "Beheren" : "Verbinden"}
            </button>
          </section>
        ))}
      </div>
      <p role="status" className="success-message">
        {message}
      </p>
      <ConfirmDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          (selectedIntegration?.name || "Integratie") +
          (connected ? " beheren" : " verbinden")
        }
        confirmLabel={
          connected ? "Demo ontkoppelen" : "Demoverbinding activeren"
        }
        onConfirm={() => {
          if (
            selected &&
            save({
              ...data,
              integrations: { ...data.integrations, [selected]: !connected },
            })
          ) {
            setMessage(
              (selectedIntegration?.name || "Integratie") +
                (connected
                  ? " is lokaal ontkoppeld."
                  : " is gekoppeld in demomodus."),
            );
            setSelected(null);
          }
        }}
      >
        <p>
          {connected
            ? "Deze verbinding is alleen gesimuleerd. Je kunt de lokale verbindingsstatus hieronder terugzetten."
            : "Dit activeert uitsluitend een lokale demostatus. Er is geen login of API-sleutel nodig."}
        </p>
      </ConfirmDialog>
    </>
  );
}
