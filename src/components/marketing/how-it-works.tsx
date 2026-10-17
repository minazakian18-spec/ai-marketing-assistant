import Image from "next/image";
import { CalendarDays, Check, Clock, FileText, Mail, MessageSquareReply, Plug, ShieldCheck, Sparkles, ToggleLeft } from "lucide-react";
import { BrandIcon, type Brand } from "@/components/brand-icon";
import { Reveal } from "./reveal";
import { InView } from "./in-view";

// Visual explainer in three alternating steps. The previews mirror real Mavix
// screens (Content Studio, Mavix Agent, Kalender, approval statuses); example
// content is illustrative. Integration availability is stated honestly.

const CHANNELS: { brand: Brand; name: string }[] = [
  { brand: "google_business", name: "Google Bedrijfsprofiel" },
  { brand: "gmail", name: "Gmail" },
  { brand: "instagram", name: "Instagram" },
  { brand: "whatsapp", name: "WhatsApp Business" },
  { brand: "google_calendar", name: "Google Agenda" },
  { brand: "search_console", name: "Search Console" },
];

function ConnectVisual() {
  return (
    <InView className="hs-how-visual hs-connect">
      <div className="hs-connect-hub" aria-hidden="true">
        <Image src="/mavix-mark.svg" alt="" width={44} height={44} />
      </div>
      <ul className="hs-connect-tiles">
        {CHANNELS.map((c, i) => (
          <li key={c.name} style={{ ["--i" as string]: i }}>
            <BrandIcon brand={c.brand} size={22} title={c.name} />
            <span>{c.name}</span>
          </li>
        ))}
      </ul>
    </InView>
  );
}

function WorkVisual() {
  return (
    <InView className="hs-how-visual hs-app">
      <div className="hs-app-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>Content Studio</span>
      </div>
      <div className="hs-app-body">
        <div className="hs-agent">
          <span className="hs-agent-name">
            <Sparkles size={13} aria-hidden="true" /> Mavix Agent
          </span>
          <p>Ik heb voor deze week 3 concepten voorbereid. Ze wachten op je goedkeuring.</p>
        </div>
        <ul className="hs-drafts">
          <li style={{ ["--i" as string]: 0 }}>
            <BrandIcon brand="instagram" size={16} title="Instagram" />
            <span>
              <strong>Instagram-post</strong>
              <small>&ldquo;Pizzamaandag: 2e pizza halve prijs 🍕&rdquo;</small>
            </span>
            <em>Concept</em>
          </li>
          <li style={{ ["--i" as string]: 1 }}>
            <MessageSquareReply size={16} aria-hidden="true" />
            <span>
              <strong>Antwoord op review ★★★★★</strong>
              <small>&ldquo;Wat leuk om te lezen, Sanne!&rdquo;</small>
            </span>
            <em>Concept</em>
          </li>
          <li style={{ ["--i" as string]: 2 }}>
            <Mail size={16} aria-hidden="true" />
            <span>
              <strong>E-mailcampagne</strong>
              <small>&ldquo;Dit weekend: verse croissants voor €1&rdquo;</small>
            </span>
            <em>Concept</em>
          </li>
        </ul>
      </div>
      <span className="hs-sample">Voorbeeldweergave</span>
    </InView>
  );
}

const WEEK: { day: string; item?: { label: string; status: "wait" | "ok" | "plan" } }[] = [
  { day: "ma", item: { label: "Pizzapost", status: "plan" } },
  { day: "di" },
  { day: "wo", item: { label: "Review", status: "ok" } },
  { day: "do", item: { label: "Weekendmail", status: "wait" } },
  { day: "vr" },
  { day: "za", item: { label: "Carrousel", status: "wait" } },
  { day: "zo" },
];
const STATUS = { wait: ["Wacht op goedkeuring", Clock], ok: ["Goedgekeurd", Check], plan: ["Ingepland", CalendarDays] } as const;

function ControlVisual() {
  return (
    <InView className="hs-how-visual hs-control">
      <div className="hs-cal">
        <div className="hs-cal-head">
          <CalendarDays size={15} aria-hidden="true" /> Kalender · deze week
        </div>
        <ol className="hs-cal-week">
          {WEEK.map((d) => {
            const s = d.item && STATUS[d.item.status];
            const Icon = s?.[1];
            return (
              <li key={d.day}>
                <span className="hs-cal-day">{d.day}</span>
                {d.item && Icon && (
                  <span className={"hs-cal-item is-" + d.item.status} title={s[0]}>
                    <Icon size={11} aria-hidden="true" />
                    <span>{d.item.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="hs-approve">
        <FileText size={16} aria-hidden="true" />
        <span>
          <strong>Weekendmail</strong>
          <small>Wacht op goedkeuring</small>
        </span>
        <span className="hs-approve-btn">Goedkeuren</span>
      </div>
      <div className="hs-pref">
        <ToggleLeft size={22} aria-hidden="true" />
        <span>
          <strong>Automatisch publiceren</strong>
          <small>Uit: alles wacht op jouw akkoord</small>
        </span>
      </div>
      <span className="hs-sample">Voorbeeldweergave</span>
    </InView>
  );
}

const steps = [
  {
    icon: Plug,
    title: "Koppel je kanalen",
    description: "Verbind de accounts die je al gebruikt met je Mavix-werkruimte: je Google-bedrijfsprofiel, Gmail, Instagram, WhatsApp Business, Google Agenda en Search Console.",
    note: "Een aantal koppelingen wacht nog op goedkeuring van Google of Meta. In de app zie je per koppeling de actuele status.",
    visual: <ConnectVisual />,
  },
  {
    icon: Sparkles,
    title: "Mavix doet het werk",
    description: "In Content Studio en met de Mavix Agent maakt Mavix posts, schrijft reviewantwoorden en bereidt e-mailcampagnes voor, in de toon van jouw merk.",
    visual: <WorkVisual />,
  },
  {
    icon: ShieldCheck,
    title: "Jij houdt controle",
    description: "Niets gaat zomaar naar buiten. Je keurt goed, past aan of plant in de kalender, en bepaalt zelf hoeveel je wilt automatiseren.",
    visual: <ControlVisual />,
  },
];

export function HowItWorks() {
  return (
    <section className="mkt-section hs-how" id="hoe-het-werkt">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Zo werkt Mavix.</h2>
          <p className="hs-lead">Drie stappen van gekoppelde kanalen naar marketing die doorloopt, zonder dat je de regie uit handen geeft.</p>
        </Reveal>
        <ol className="hs-how-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={"hs-how-step" + (i % 2 ? " is-flipped" : "")}>
              <Reveal className="hs-how-text">
                <span className="hs-how-num">
                  <s.icon size={16} aria-hidden="true" /> Stap {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                {s.note && <p className="hs-how-note">{s.note}</p>}
              </Reveal>
              <Reveal delay={80}>{s.visual}</Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
