// "Jouw to-do's": the dashboard's task center, built only from real workspace
// state. Urgent items (failures, broken connections) come first, then open
// onboarding steps, then what is already done.

export type Todo = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta?: string;
  done: boolean;
  urgent?: boolean;
  /** 0–100 for steps with measurable progress. */
  progress?: number;
};

export type TodoInput = {
  brandScore: number;
  review: { count: number; href: string };
  failed: { count: number; href: string };
  campaigns: number;
  plannedThisWeek: number;
  /** Connection status per provider; undefined while still loading. */
  status?: (provider: string) => string;
};

const PROVIDERS: [string, string][] = [
  ["instagram", "Instagram"],
  ["google_business", "Google Bedrijfsprofiel"],
  ["gmail", "Gmail"],
  ["google_calendar", "Google Agenda"],
];
const BROKEN = ["reconnect_required", "permission_missing", "error"];

export function buildTodos(i: TodoInput): Todo[] {
  const urgent: Todo[] = [];
  if (i.failed.count)
    urgent.push({
      id: "failed",
      title: i.failed.count === 1 ? "Een gepland item heeft aandacht nodig" : `${i.failed.count} geplande items hebben aandacht nodig`,
      detail: "Bekijk wat er misging en plan opnieuw in.",
      href: i.failed.href,
      cta: "Bekijken",
      done: false,
      urgent: true,
    });
  if (i.status) {
    for (const [provider, label] of PROVIDERS)
      if (BROKEN.includes(i.status(provider)))
        urgent.push({
          id: "reconnect-" + provider,
          title: `${label} opnieuw koppelen`,
          detail: "De koppeling is verlopen. Eén keer opnieuw verbinden en alles loopt weer.",
          href: "/account/integraties",
          cta: "Opnieuw koppelen",
          done: false,
          urgent: true,
        });
    if (i.status("google_business") === "selection_required")
      urgent.push({
        id: "gbp-location",
        title: "Kies je bedrijfslocatie",
        detail: "Nog één stap om je Google-reviews in Mavix te zien.",
        href: "/account/integraties?select=google_business",
        cta: "Locatie kiezen",
        done: false,
        urgent: true,
      });
  }

  const steps: Todo[] = [
    {
      id: "review",
      title: "Wacht op goedkeuring",
      detail: i.review.count
        ? `${i.review.count} ${i.review.count === 1 ? "concept staat" : "concepten staan"} klaar voor jouw akkoord.`
        : "Niets wacht op je akkoord. Nieuwe concepten verschijnen hier.",
      href: i.review.count ? i.review.href : "/social?tab=assist",
      cta: "Beoordelen",
      done: i.review.count === 0,
    },
    {
      id: "brand",
      title: "Brand Hub aanvullen",
      detail:
        i.brandScore >= 100
          ? "Je merkprofiel is compleet. Mavi schrijft in jouw stem."
          : "Hoe completer je merkprofiel, hoe beter Mavi in jouw stem schrijft.",
      href: "/brand-hub",
      cta: "Aanvullen",
      done: i.brandScore >= 100,
      progress: Math.max(0, Math.min(100, Math.round(i.brandScore))),
    },
    {
      id: "week",
      title: "Plan je content voor deze week",
      detail: i.plannedThisWeek
        ? `${i.plannedThisWeek} ${i.plannedThisWeek === 1 ? "item staat" : "items staan"} ingepland voor de komende 7 dagen.`
        : "Zet minstens één post of e-mail klaar voor de komende 7 dagen.",
      href: "/calendar",
      cta: "Kalender openen",
      done: i.plannedThisWeek > 0,
    },
    {
      id: "email",
      title: "Maak je eerste e-mailcampagne",
      detail: i.campaigns ? "Je eerste campagne staat in je werkruimte." : "Een nieuwsbrief staat in een paar minuten klaar.",
      href: "/email?tab=assist",
      cta: "Campagne maken",
      done: i.campaigns > 0,
    },
  ];
  if (i.status) {
    const instagram = i.status("instagram");
    const gbp = i.status("google_business");
    steps.push(
      {
        id: "instagram",
        title: "Koppel Instagram",
        detail: instagram === "connected" ? "Instagram-berichten komen binnen in je Inbox." : "Beantwoord Instagram-berichten direct vanuit je Inbox.",
        href: "/account/integraties",
        cta: "Koppelen",
        done: instagram !== "disconnected" && !BROKEN.includes(instagram),
      },
      {
        id: "gbp",
        title: "Koppel Google Bedrijfsprofiel",
        detail: gbp === "connected" ? "Je Google-reviews staan in Mavix." : "Lees en beantwoord je Google-reviews op één plek.",
        href: "/account/integraties",
        cta: "Koppelen",
        done: gbp !== "disconnected" && !BROKEN.includes(gbp),
      },
    );
  }
  return [...urgent, ...steps.filter((s) => !s.done), ...steps.filter((s) => s.done)];
}

/** Progress over the regular steps (urgent fixes are not "progress"). */
export function todoProgress(todos: Todo[]) {
  const steps = todos.filter((t) => !t.urgent);
  return { done: steps.filter((t) => t.done).length, total: steps.length };
}
