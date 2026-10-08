"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, Inbox, Sparkles, Settings, Plug } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  regenerateResponse,
  reviewSettingsError,
  type Review,
} from "@/lib/review-model";
import { ReviewOverview } from "./overview";
import { ReviewInbox } from "./inbox";
import { ReviewAutoReply } from "./auto-reply";
import { ReviewSettings } from "./settings";
import { LiveReviews } from "./live";
import { ReplyPreferences } from "./reply-preferences";
import { isBrowserDemo } from "@/lib/demo";

type ReviewTab = "overview" | "inbox" | "auto-reply" | "settings";
const tabs: [ReviewTab, string, typeof LayoutDashboard][] = [
  ["overview", "Overzicht", LayoutDashboard],
  ["inbox", "Reviews", Inbox],
  ["auto-reply", "Auto Reply", Sparkles],
  ["settings", "Instellingen", Settings],
];

const newReviewPool: Omit<Review, "id" | "initials" | "status" | "date">[] = [
  {
    reviewer: "Nina van Dijk",
    rating: 5,
    text: "Heldere communicatie en een resultaat waar we heel blij mee zijn.",
    aiResponse:
      "Dankjewel Nina! Wat fijn dat de communicatie en het resultaat goed zijn bevallen.",
  },
  {
    reviewer: "Bram Koster",
    rating: 4,
    text: "Prettige samenwerking, alleen de planning schoof een dag op.",
    aiResponse:
      "Bedankt voor je review, Bram! Fijn dat de samenwerking goed voelde — we kijken naar onze planning.",
  },
  {
    reviewer: "Elif Yildiz",
    rating: 2,
    text: "De service voldeed niet helemaal aan mijn verwachtingen op basis van de website.",
    aiResponse:
      "Vervelend om te horen, Elif. Neem gerust contact op zodat we kunnen kijken wat er beter kan.",
  },
];

function Workspace() {
  const search = useSearchParams();
  const { data, ready, save } = useWorkspace();
  const reviews = data.review.reviews;
  const settings = data.review.settings;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Real workspaces show real Google reviews only; sample reviews and the
  // Auto Reply simulation are test-mode only.
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => setDemo(isBrowserDemo()), []);
  const raw = search.get("tab");
  const tab: ReviewTab = (
    ["overview", "inbox", "auto-reply", "settings"] as const
  ).includes(raw as ReviewTab)
    ? (raw as ReviewTab)
    : "overview";

  async function updateReview(id: string, patch: Partial<Review>) {
    await save({
      ...data,
      review: {
        settings,
        reviews: reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    });
  }
  function approve(id: string) {
    updateReview(id, { status: "approved" });
  }
  function publish(id: string) {
    updateReview(id, { status: "published" });
  }
  function regenerate(id: string) {
    const target = reviews.find((r) => r.id === id);
    if (!target) return;
    updateReview(id, {
      aiResponse: regenerateResponse(target, settings),
      status: "drafted",
    });
  }
  function saveResponse(id: string, text: string) {
    updateReview(id, { aiResponse: text, status: "drafted" });
  }
  async function updateSettings(next: typeof settings) {
    const error = reviewSettingsError(next);
    if (error) {
      setMessage(error);
      return;
    }
    await save({ ...data, review: { settings: next, reviews } });
  }
  function simulate() {
    setBusy(true);
    setTimeout(async () => {
      const pick =
        newReviewPool[Math.floor(Math.random() * newReviewPool.length)];
      const id = "review-sim-" + Date.now();
      const initials = pick.reviewer
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase();
      const autoHandled =
        settings.mode === "auto" &&
        !settings.requireApproval &&
        pick.rating >= settings.autoPublishMinRating;
      const shell: Review = {
        ...pick,
        id,
        initials,
        date: new Date().toISOString(),
        aiResponse: "",
        status: autoHandled ? "published" : settings.mode === "assist" ? "new" : "drafted",
        autoHandled,
      };
      const newReview: Review = {
        ...shell,
        aiResponse: regenerateResponse(shell, settings),
      };
      await save({ ...data, review: { settings, reviews: [newReview, ...reviews] } });
      setBusy(false);
    }, 550);
  }

  if (!ready || demo === null) return <p role="status">Reviews laden…</p>;
  const visibleTabs = demo ? tabs : tabs.filter(([key]) => key !== "auto-reply");
  const active: ReviewTab = !demo && tab === "auto-reply" ? "overview" : tab;
  return (
    <div className="rv-workspace">
      <PageHeading
        eyebrow="Marketing"
        title="Reviews"
        description="Lees en beantwoord je Google-reviews vanuit één plek. Wat je plaatst, staat direct op Google."
        action={
          <Link className="button secondary" href="/account/integraties">
            <Plug size={15} />
            Integraties
          </Link>
        }
      />
      {demo && (
        <p className="ws-notice">
          Testmodus: je ziet voorbeeldreviews. Met een echt account beheer je hier je echte Google-reviews.
        </p>
      )}
      <nav className="ws-tabs" aria-label="Reviews onderdelen">
        {visibleTabs.map(([key, label, Icon]) => (
          <Link
            key={key}
            href={"/reviews?tab=" + key}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      {message && (
        <p role="status" className="ig-feedback ig-top-feedback">
          {message}
        </p>
      )}
      <div className="workspace-tab-enter" key={active}>
        {!demo && (active === "overview" || active === "inbox") && <LiveReviews tab={active} />}
        {!demo && active === "settings" && <ReplyPreferences settings={settings} onChange={updateSettings} />}
        {demo && tab === "overview" && (
          <ReviewOverview
            reviews={reviews}
            mode={settings.mode}
            enabled={settings.enabled}
            onApprove={approve}
            onPublish={publish}
            onRegenerate={regenerate}
            onSaveResponse={saveResponse}
          />
        )}
        {demo && tab === "inbox" && (
          <ReviewInbox
            reviews={reviews}
            onApprove={approve}
            onPublish={publish}
            onRegenerate={regenerate}
            onSaveResponse={saveResponse}
          />
        )}
        {demo && tab === "auto-reply" && (
          <ReviewAutoReply
            settings={settings}
            onChange={updateSettings}
            onSimulate={simulate}
            busy={busy}
          />
        )}
        {demo && tab === "settings" && (
          <ReviewSettings settings={settings} onChange={updateSettings} />
        )}
      </div>
      <div className="ig-workspace-footer">
        <Link href="/brand-hub">Brand Hub</Link>
      </div>
    </div>
  );
}

export function ReviewWorkspace() {
  return (
    <Suspense fallback={<p>Reviews laden…</p>}>
      <Workspace />
    </Suspense>
  );
}
