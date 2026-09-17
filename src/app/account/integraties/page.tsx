"use client";
import { useState } from "react";
import { Instagram, Mail, Plug, Check } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type { Integrations } from "@/lib/types";
const integrations = [
  {
    key: "instagram",
    name: "Instagram",
    Icon: Instagram,
    description: "Geef je Instagram-content een plek in je werkruimte.",
  },
  {
    key: "email",
    name: "E-mail",
    Icon: Mail,
    description: "Bereid je werkruimte voor op e-mailcampagnes.",
  },
] as const;
export default function IntegrationsPage() {
  const { data, save } = useWorkspace();
  const [selected, setSelected] = useState<keyof Integrations | null>(null);
  const [message, setMessage] = useState("");
  const selectedIntegration = integrations.find((i) => i.key === selected);
  const connected = selected ? data.integrations[selected] : false;
  return (
    <>
      <PageHeading
        eyebrow="JOUW KANALEN"
        title="Integraties"
        description="Beheer de kanalen voor je marketing."
      />
      <div className="demo-notice">
        <span className="badge draft">Demomodus</span>Je kunt de
        verbindingsstatus uitproberen. Er worden geen accounts gekoppeld of
        gegevens verstuurd.
      </div>
      <div className="integration-grid">
        {integrations.map(({ key, name, Icon, description }) => (
          <section className="panel integration-card" key={key}>
            <div className="integration-card-top">
              <span className={"integration-icon " + key}>
                <Icon size={27} />
              </span>
              <span
                className={
                  "badge " + (data.integrations[key] ? "approved" : "draft")
                }
              >
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
