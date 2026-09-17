"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  WorkspaceNav,
  ChannelOverview,
  SettingsGroup,
  ContentLibrary,
} from "@/components/channel/workspace-ui";
import { workspaceView, modeName } from "@/lib/workspace-navigation";
import { recipients } from "@/lib/contact-data";
import {
  PenLine,
  Orbit,
  CheckCheck,
  CalendarDays,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  defaultEmail,
  emailModes,
  emailSettingsError,
  type EmailCampaign,
  type EmailSettings,
} from "@/lib/email-model";
import { generateEmail, simulateEmail } from "@/lib/providers/email-mock";
import { localDateTime } from "@/lib/instagram-model";
import { EmailCreate } from "./create";
import { EmailAutopilot } from "./autopilot";
import { EmailQueue } from "./queues";
function Workspace() {
  const { data, ready, save } = useWorkspace();
  const router = useRouter();
  const search = useSearchParams();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const settings = data.email?.settings || defaultEmail;
  const campaigns = data.email?.campaigns || [];
  const initial = campaigns.find((c) => c.id === search.get("campaign"));
  const tab = workspaceView(
    search.get("tab"),
    !!search.get("campaign"),
    settings.mode,
  );
  const items = campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.kind.replace("Create ", ""),
    status: c.status,
    date: c.date,
    createdAt: c.createdAt,
    href: "/email-ai?tab=assist&campaign=" + encodeURIComponent(c.id),
  }));
  function persist(c: EmailCampaign) {
    return save({
      ...data,
      email: {
        settings,
        campaigns: campaigns.some((p) => p.id === c.id)
          ? campaigns.map((p) => (p.id === c.id ? c : p))
          : [c, ...campaigns],
      },
    });
  }
  function navigate(next: string, c?: EmailCampaign) {
    router.replace(
      "/email-ai?tab=" +
        next +
        (c ? "&campaign=" + encodeURIComponent(c.id) : ""),
      { scroll: false },
    );
    setMessage("");
  }
  async function run(s: EmailSettings, workflow: boolean) {
    const error = emailSettingsError(s);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      const result = await simulateEmail(s, data.profile, new Date(), workflow);
      if (
        save({
          ...data,
          email: {
            settings: s,
            campaigns: [...result.campaigns, ...campaigns],
          },
        })
      )
        setMessage(
          `${result.campaigns.length} mockcampagnes gemaakt: ${result.campaigns.filter((c) => c.status === "draft").length} ter goedkeuring, ${result.campaigns.filter((c) => c.status === "scheduled").length} ingepland, ${result.campaigns.filter((c) => c.status === "blocked").length} geblokkeerd. ${result.skipped} overgeslagen. Er is niets verstuurd.`,
        );
    } catch {
      setMessage("Simulatie is niet gelukt. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }
  async function examples() {
    setBusy(true);
    try {
      const added: EmailCampaign[] = [];
      for (let i = 0; i < 3; i++) {
        if (campaigns.some((c) => c.id === "email-example-" + i)) continue;
        const c = await generateEmail({
          prompt: [
            "Onze maandelijkse selectie",
            "Een warm welkom",
            "Nieuws voor onze vaste klanten",
          ][i],
          kind: i === 1 ? "Create Welcome Email" : "Create Newsletter",
          profile: data.profile,
          audience: i === 1 ? "Nieuwe klanten" : "Nieuwsbriefabonnees",
          product: "",
          offer: "",
          useWebsite: false,
          variant: i,
        });
        c.id = "email-example-" + i;
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        d.setHours(10, 0, 0, 0);
        c.date = localDateTime(d);
        c.reason = "Handmatig toegevoegd voorbeeld; controleer de inhoud.";
        added.push(c);
      }
      if (
        save({
          ...data,
          email: { settings, campaigns: [...added, ...campaigns] },
        })
      )
        setMessage(
          added.length
            ? "Voorbeeldcampagnes lokaal toegevoegd."
            : "De voorbeeldcampagnes staan al in je werkruimte.",
        );
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Email workspace laden…</p>;
  return (
    <div className="instagram-workspace email-workspace">
      <PageHeading
        eyebrow="JOUW E-MAIL WORKSPACE"
        title="Email AI"
        description="Maak e-mailcampagnes zelf of laat Mavix je e-mailmarketing zelfstandig beheren."
        action={
          <span className="ig-prototype">
            <ShieldCheck size={15} />
            Lokaal prototype
          </span>
        }
      />

      <WorkspaceNav root="/email-ai" channel="Email" view={tab} />
      {tab !== "overview" && (
        <div className="channel-context">
          <span>
            Actieve modus: <strong>{modeName(settings.mode)}</strong> ·{" "}
            {settings.enabled && settings.mode !== "assist"
              ? "Autopilot actief"
              : "Autopilot uit"}
          </span>
          <small>Lokaal prototype · geen echte verzending</small>
        </div>
      )}
      <p role="status" className="ig-feedback ig-top-feedback">
        {message}
      </p>
      <div className="workspace-tab-enter" key={tab}>
        {tab === "overview" ? (
          <>
            <ChannelOverview
              channel="Email"
              root="/email-ai"
              mode={settings.mode}
              enabled={settings.enabled}
              items={items}
              contacts={recipients("Alle contacten").length}
            />
            <SettingsGroup
              title="Wacht op goedkeuring"
              description="Bekijk en beoordeel je concepten."
            >
              <EmailQueue
                campaigns={campaigns}
                scheduled={false}
                onEdit={(c) => navigate("assist", c)}
                onSave={persist}
                onExamples={() => {
                  if (!busy) void examples();
                }}
              />
            </SettingsGroup>
            <SettingsGroup
              title="Geplande content"
              description="Je planning en eventuele blokkades."
              open={search.get("tab") === "scheduled"}
            >
              <EmailQueue
                campaigns={campaigns}
                scheduled
                onEdit={(c) => navigate("assist", c)}
                onSave={persist}
                onExamples={() => {
                  if (!busy) void examples();
                }}
              />
            </SettingsGroup>
            <ContentLibrary items={items} />
          </>
        ) : tab === "assist" ? (
          <>
            <div className="channel-assist-intro">
              <p>
                AI doet alleen iets wanneer jij een opdracht geeft. Automatische
                instellingen vind je bij Auto Create en Full Autopilot.
              </p>
              {settings.mode !== "assist" && (
                <button
                  className="button secondary"
                  onClick={() =>
                    save({
                      ...data,
                      email: {
                        campaigns,
                        settings: {
                          ...settings,
                          mode: "assist",
                          enabled: false,
                        },
                      },
                    })
                  }
                >
                  Assist activeren
                </button>
              )}
            </div>
            {search.get("campaign") && !initial && (
              <p role="alert">
                Dit concept is niet gevonden. Je kunt hieronder nieuwe content
                maken.
              </p>
            )}
            <EmailCreate
              key={initial?.id || "new"}
              initial={initial}
              profile={data.profile}
              onSave={persist}
            />
            <SettingsGroup
              title="Wacht op goedkeuring"
              description="Je handmatige en automatische concepten."
            >
              <EmailQueue
                campaigns={campaigns}
                scheduled={false}
                onEdit={(c) => navigate("assist", c)}
                onSave={persist}
                onExamples={() => {
                  if (!busy) void examples();
                }}
              />
            </SettingsGroup>
          </>
        ) : (
          <>
            <EmailAutopilot
              pageMode={tab}
              key={tab + settings.mode + settings.enabled}
              settings={settings}
              profile={data.profile}
              campaigns={campaigns}
              onSave={(s) =>
                save({ ...data, email: { settings: s, campaigns } })
              }
              onRun={run}
              busy={busy}
            />
            {tab === "auto" ? (
              <div className="channel-queue-section">
                <EmailQueue
                  campaigns={campaigns}
                  scheduled={false}
                  onEdit={(c) => navigate("assist", c)}
                  onSave={persist}
                  onExamples={() => {
                    if (!busy) void examples();
                  }}
                />
              </div>
            ) : (
              <>
                <div className="channel-queue-section">
                  <EmailQueue
                    campaigns={campaigns}
                    scheduled
                    onEdit={(c) => navigate("assist", c)}
                    onSave={persist}
                    onExamples={() => {
                      if (!busy) void examples();
                    }}
                  />
                </div>
                <SettingsGroup
                  title="Goedkeuring bij twijfel"
                  description="Concepten die jouw controle nodig hebben."
                >
                  <EmailQueue
                    campaigns={campaigns}
                    scheduled={false}
                    onEdit={(c) => navigate("assist", c)}
                    onSave={persist}
                    onExamples={() => {
                      if (!busy) void examples();
                    }}
                  />
                </SettingsGroup>
              </>
            )}
          </>
        )}
      </div>
      <div className="ig-workspace-footer">
        <Link href="/brand-hub">Brand Hub</Link>
        <span>Campagnes en instellingen blijven in deze browser.</span>
        <Link href="/contacten">Contacten bekijken</Link>
      </div>
    </div>
  );
}
export function EmailWorkspace() {
  return (
    <Suspense fallback={<p>Email workspace laden…</p>}>
      <Workspace />
    </Suspense>
  );
}
