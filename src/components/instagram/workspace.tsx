"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import {
  WorkspaceNav,
  ChannelOverview,
  SettingsGroup,
  ContentLibrary,
} from "@/components/channel/workspace-ui";
import { workspaceView, modeName } from "@/lib/workspace-navigation";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  PenLine,
  Orbit,
  CheckCheck,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  defaultInstagram,
  settingsError,
  simulationSlots,
  samplePosts,
  type InstagramSettings,
} from "@/lib/instagram-model";
import { generateContent } from "@/lib/providers/mock";
import type { Post } from "@/lib/types";
import { InstagramOverview } from "./overview";
import { CreateStudio } from "./create";
import { AutopilotSettings } from "./autopilot";
import { ApprovalQueue, ScheduledContent } from "./queues";
function Workspace() {
  const { data, ready, save } = useWorkspace();
  const search = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const editPost = data.posts.find((p) => p.id === search.get("post"));
  const settings = data.instagram || defaultInstagram;
  const tab = workspaceView(search.get("tab"), !!search.get("post"));
  const items = data.posts.map((p) => ({
    id: p.id,
    title: p.prompt,
    kind: p.contentType || "Post",
    status: p.status,
    date: p.date,
    createdAt: p.createdAt,
    href: "/instagram-ai?tab=assist&post=" + encodeURIComponent(p.id),
  }));
  function navigate(next: string, post?: Post) {
    router.replace(
      "/instagram-ai?tab=" +
        next +
        (post ? "&post=" + encodeURIComponent(post.id) : ""),
      { scroll: false },
    );
    setMessage("");
  }
  async function persist(post: Post) {
    return await save({
      ...data,
      posts: data.posts.some((p) => p.id === post.id)
        ? data.posts.map((p) => (p.id === post.id ? post : p))
        : [post, ...data.posts],
    });
  }
  async function examples() {
    const added = samplePosts(new Date()).filter(
      (p) => !data.posts.some((existing) => existing.id === p.id),
    );
    if (await save({ ...data, posts: [...added, ...data.posts] }))
      setMessage(
        added.length
          ? added.length + " lokale voorbeelditems toegevoegd."
          : "De voorbeeldset staat al in je werkruimte.",
      );
  }
  async function simulate(s: InstagramSettings) {
    const error = settingsError(s);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      const slots = simulationSlots(s, new Date());
      const topicToRule: Record<string, string> = {
        products: "products",
        reviews: "reviews",
        informative: "tips",
        behind: "branding",
        offers: "offers",
      };
      const topics = Object.keys(s.mix).filter(
        (k) => s.mix[k] > 0 && s.allowed[topicToRule[k]],
      );
      if (!topics.length) {
        setMessage("Sta minimaal één onderwerp uit je contentmix toe.");
        return;
      }
      const total = topics.reduce((n, k) => n + s.mix[k], 0);
      const posts: Post[] = [];
      let skipped = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const point = ((i + 0.5) / slots.length) * total;
        let sum = 0;
        const topic =
          topics.find((k) => {
            sum += s.mix[k];
            return point <= sum;
          }) || topics[0];
        const missing =
          !data.profile.name.trim() ||
          !data.profile.description.trim() ||
          (topic === "products" && !data.profile.products?.trim()) ||
          ["reviews", "offers"].includes(topic);
        if (missing && s.uncertain === "skip") {
          skipped++;
          continue;
        }
        const product =
          topic === "products"
            ? (data.profile.products || "").split("\n").filter(Boolean)[0] || ""
            : "";
        const topicTitle: Record<string, string> = {
          products: "Product in de spotlight",
          reviews: "Reviewconcept — voeg een echte review toe",
          informative: "Een tip vanuit ons bedrijf",
          behind: "Een kijkje achter de schermen",
          offers: "Aanbieding — bevestig eerst de actiegegevens",
        };
        const post = await generateContent({
          prompt: topicTitle[topic] || "Nieuw merkverhaal",
          type: slot.type,
          profile: data.profile,
          product,
          useWebsite: s.allowed.website && !!data.profile.website,
          photos: data.profile.media?.slice(0, 1) || [],
          duration: 5,
          videoMode: "Short AI Reel",
          variant: i % 3,
        });
        posts.push({
          ...post,
          source: "autopilot",
          date: slot.date,
          status: missing ? "draft" : slot.automatic ? "scheduled" : "draft",
          failureReason: missing
            ? "Controleer de ontbrekende broninformatie vóór goedkeuring."
            : undefined,
        });
      }
      if (await save({ ...data, instagram: s, posts: [...posts, ...data.posts] }))
        setMessage(
          posts.length +
            " mockitems gemaakt: " +
            posts.filter((p) => p.status === "draft").length +
            " in de goedkeuringswachtrij, " +
            posts.filter((p) => p.status === "scheduled").length +
            " in de planning." +
            (skipped
              ? " " + skipped + " overgeslagen bij ontbrekende informatie."
              : "") +
            (!slots.length
              ? " Er zijn geen toekomstige tijdsloten voor de gekozen dagen."
              : ""),
        );
    } catch {
      setMessage("Simulatie is niet gelukt. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Instagram workspace laden…</p>;
  return (
    <div className="instagram-workspace">
      <PageHeading
        eyebrow="JOUW INSTAGRAM WORKSPACE"
        title="Instagram AI"
        description="Maak content zelf of laat Mavix je Instagram zelfstandig beheren."
        action={
          <span className="ig-prototype">
            <ShieldCheck size={15} />
            Lokaal prototype
          </span>
        }
      />

      <WorkspaceNav root="/instagram-ai" channel="Instagram" view={tab} />
      {tab !== "overview" && (
        <div className="channel-context">
          <span>
            Actieve modus: <strong>{modeName(settings.mode)}</strong> ·{" "}
            {settings.enabled && settings.mode !== "assist"
              ? "Autopilot actief"
              : "Autopilot uit"}
          </span>
          <small>Lokaal prototype · geen echte publicatie</small>
        </div>
      )}
      <p role="status" className="ig-feedback ig-top-feedback">
        {message}
      </p>
      <div className="workspace-tab-enter" key={tab}>
        {tab === "overview" ? (
          <InstagramOverview posts={data.posts} settings={settings} />
        ) : tab === "assist" ? (
          <>
            <div className="channel-assist-intro">
              <p>
                AI doet alleen iets wanneer jij een opdracht geeft. Automatische
                instellingen vind je bij Auto Create.
              </p>
              {settings.mode !== "assist" && (
                <button
                  className="button secondary"
                  onClick={async () =>
                    await save({
                      ...data,
                      instagram: {
                        ...settings,
                        mode: "assist",
                        enabled: false,
                      },
                    })
                  }
                >
                  Assist activeren
                </button>
              )}
            </div>
            {search.get("post") && !editPost && (
              <p role="alert">
                Dit concept is niet gevonden. Je kunt hieronder nieuwe content
                maken.
              </p>
            )}
            <CreateStudio
              key={editPost?.id || "new"}
              editPost={editPost}
              initialDate={search.get("date") || undefined}
              initialType={search.get("type") || undefined}
              profile={data.profile}
              onPersist={persist}
            />
            <SettingsGroup
              title="Wacht op goedkeuring"
              description="Je handmatige en automatische concepten."
            >
              <ApprovalQueue
                posts={data.posts}
                onEdit={(p) => navigate("assist", p)}
                onExamples={examples}
                onChange={persist}
              />
            </SettingsGroup>
          </>
        ) : (
          <>
            <AutopilotSettings
              key={settings.mode + settings.enabled}
              settings={settings}
              profile={data.profile}
              onSave={async (s) => await save({ ...data, instagram: s })}
              onRun={simulate}
              busy={busy}
            />
            {settings.requireApproval ? (
              <div className="channel-queue-section">
                <ApprovalQueue
                  posts={data.posts}
                  onEdit={(p) => navigate("assist", p)}
                  onExamples={examples}
                  onChange={persist}
                />
              </div>
            ) : (
              <>
                <div className="channel-queue-section">
                  <ScheduledContent
                    posts={data.posts}
                    onEdit={(p) => navigate("assist", p)}
                    onExamples={examples}
                  />
                </div>
                <SettingsGroup
                  title="Goedkeuring bij twijfel"
                  description="Concepten die jouw controle nodig hebben."
                >
                  <ApprovalQueue
                    posts={data.posts}
                    onEdit={(p) => navigate("assist", p)}
                    onExamples={examples}
                    onChange={persist}
                  />
                </SettingsGroup>
              </>
            )}
          </>
        )}
      </div>
      <div className="ig-workspace-footer">
        <Link href="/brand-hub">Brand Hub</Link>
        <span>Jouw inhoud en instellingen blijven in deze browser.</span>
        {!data.posts.length && (
          <button onClick={examples}>Voorbeeldcontent toevoegen</button>
        )}
      </div>
    </div>
  );
}
export function InstagramWorkspace() {
  return (
    <Suspense fallback={<p>Instagram workspace laden…</p>}>
      <Workspace />
    </Suspense>
  );
}
