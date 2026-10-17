"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, Inbox, LayoutDashboard, Mail, MessageSquareText, PenSquare, Sparkles, Star, type LucideIcon } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { Reveal } from "./reveal";

// "Al je marketing. Eén slimme werkruimte." Interactive tour of the modules
// that really exist in Mavix. Previews are simplified renderings of those
// screens with illustrative example data.

type Module = { id: string; label: string; icon: LucideIcon; title: string; text: string; preview: ReactNode };

const Row = ({ icon, title, meta, status, tone = "" }: { icon: ReactNode; title: string; meta: string; status?: string; tone?: string }) => (
  <li className="ws-row">
    <span className="ws-row-icon">{icon}</span>
    <span className="ws-row-text">
      <strong>{title}</strong>
      <small>{meta}</small>
    </span>
    {status && <em className={"ws-status " + tone}>{status}</em>}
  </li>
);

const MODULES: Module[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Je dag in één oogopslag",
    text: "Nieuwe reviews, ingeplande posts, campagnes en taken die op je wachten. Je ziet meteen wat aandacht nodig heeft.",
    preview: (
      <>
        <div className="ws-kpis">
          <span>
            <small>Gemiddelde score</small>
            <strong>4,8 ★</strong>
          </span>
          <span>
            <small>Ingepland deze week</small>
            <strong>5 posts</strong>
          </span>
          <span>
            <small>Wacht op jou</small>
            <strong>3 taken</strong>
          </span>
        </div>
        <ul className="ws-list">
          <Row icon={<Star size={14} />} title="2 nieuwe reviews" meta="Antwoordvoorstellen staan klaar" status="Bekijken" tone="is-purple" />
          <Row icon={<CalendarDays size={14} />} title="Pizzamaandag-post" meta="Maandag 17:00" status="Ingepland" tone="is-green" />
        </ul>
      </>
    ),
  },
  {
    id: "agent",
    label: "Mavix Agent",
    icon: Sparkles,
    title: "Vraag het gewoon aan Mavix",
    text: "Geef een opdracht in gewone taal. De Agent bereidt posts, mails en antwoorden voor en legt ze klaar voor jouw akkoord.",
    preview: (
      <div className="ws-chat">
        <p className="ws-bubble is-user">Maak een actie voor rustige dinsdagavonden.</p>
        <p className="ws-bubble">
          Goed idee. Ik heb een Instagram-post en een korte nieuwsbrief voorbereid met 15% korting op dinsdag. Wil je ze bekijken?
        </p>
        <div className="ws-chips">
          <span>Instagram-post · concept</span>
          <span>Nieuwsbrief · concept</span>
        </div>
      </div>
    ),
  },
  {
    id: "studio",
    label: "Content Studio",
    icon: PenSquare,
    title: "Alle content op één plek gemaakt",
    text: "Posts, carrousels, e-mails en marketingteksten maak je in Content Studio, met je Brand Hub als basis.",
    preview: (
      <ul className="ws-list">
        <Row icon={<BrandIcon brand="instagram" size={14} title="Instagram" />} title="Carrousel: 5 redenen voor onze lunch" meta="5 slides · caption klaar" status="Concept" />
        <Row icon={<Mail size={14} />} title="Nieuwsbrief: weekendmenu" meta="Onderwerpregel + 2 varianten" status="Concept" />
        <Row icon={<PenSquare size={14} />} title="Tekst voor je website" meta="Over ons, 120 woorden" status="Goedgekeurd" tone="is-green" />
      </ul>
    ),
  },
  {
    id: "social",
    label: "Social",
    icon: CalendarDays,
    title: "Instagram zonder gedoe",
    text: "Maak posts met AI-beeld of je eigen foto's, bekijk een voorbeeld zoals op Instagram en plan ze in.",
    preview: (
      <div className="ws-social">
        <div className="ws-tile" style={{ background: "linear-gradient(135deg,#fde68a,#f97316)" }} />
        <div className="ws-tile" style={{ background: "linear-gradient(135deg,#c4b5fd,#6d28d9)" }} />
        <div className="ws-tile" style={{ background: "linear-gradient(135deg,#a7f3d0,#059669)" }} />
        <p>
          <BrandIcon brand="instagram" size={14} title="Instagram" /> 3 posts gepland voor deze week
        </p>
      </div>
    ),
  },
  {
    id: "email",
    label: "E-mail",
    icon: Mail,
    title: "Nieuwsbrieven en campagnes",
    text: "Schrijf campagnes met AI, kies je ontvangers op basis van toestemming en houd afmeldingen netjes bij.",
    preview: (
      <ul className="ws-list">
        <Row icon={<Mail size={14} />} title="Dit weekend: verse croissants voor €1" meta="Vaste klanten · met toestemming" status="Concept" />
        <Row icon={<Mail size={14} />} title="Nieuw: ons najaarsmenu" meta="Alle contacten" status="Ingepland" tone="is-green" />
      </ul>
    ),
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: Star,
    title: "Een sterke online reputatie",
    text: "Mavix stelt per review een persoonlijk antwoord voor. Jij leest mee, past aan en keurt goed.",
    preview: (
      <ul className="ws-list">
        <Row icon={<BrandIcon brand="google_reviews" size={14} title="Google" />} title="★★★★★ Sanne de V." meta="Antwoordvoorstel klaar" status="Wacht op jou" tone="is-amber" />
        <Row icon={<BrandIcon brand="google_reviews" size={14} title="Google" />} title="★★★☆☆ Mark B." meta="Excuses + uitnodiging om terug te komen" status="Wacht op jou" tone="is-amber" />
      </ul>
    ),
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    title: "Klantgesprekken samengebracht",
    text: "Berichten uit je gekoppelde kanalen komen in één inbox, met AI-hulp bij het antwoorden.",
    preview: (
      <ul className="ws-list">
        <Row icon={<BrandIcon brand="whatsapp" size={14} title="WhatsApp" />} title="Hebben jullie vanavond nog plek?" meta="WhatsApp · 2 min geleden" status="Antwoord klaar" tone="is-purple" />
        <Row icon={<BrandIcon brand="gmail" size={14} title="Gmail" />} title="Offerte voor een verjaardag" meta="Gmail · vandaag" />
      </ul>
    ),
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: CalendarDays,
    title: "Alles in één planning",
    text: "Posts, campagnes en afspraken op één tijdlijn. Je ziet wat er gepland staat en wat nog goedkeuring nodig heeft.",
    preview: (
      <div className="ws-cal">
        {["ma", "di", "wo", "do", "vr"].map((d, i) => (
          <span key={d}>
            <small>{d}</small>
            {i === 0 && <i className="is-purple">Post</i>}
            {i === 2 && <i className="is-green">Mail</i>}
            {i === 3 && <i className="is-amber">Review</i>}
            {i === 4 && <i className="is-purple">Carrousel</i>}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "insights",
    label: "Inzichten",
    icon: BarChart3,
    title: "Begrijp wat werkt",
    text: "Inzichten laat je resultaten zien met uitleg en onderzoek naar je bedrijf, zodat je weet wat je volgende stap is.",
    preview: (
      <div className="ws-insight">
        <div className="ws-bars" aria-hidden="true">
          {[38, 52, 46, 64, 72, 68, 84].map((h, i) => (
            <i key={i} style={{ height: h + "%" }} />
          ))}
        </div>
        <p>
          <MessageSquareText size={14} aria-hidden="true" /> Je posts met eten scoren beter dan sfeerbeelden. Tip: plan er twee per week.
        </p>
      </div>
    ),
  },
];

export function WorkspaceShowcase() {
  const [active, setActive] = useState(0);
  const m = MODULES[active];
  return (
    <section className="mkt-section ws" id="werkruimte" aria-labelledby="ws-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <span className="mkt-eyebrow">Alles in één werkruimte</span>
          <h2 className="mkt-h2" id="ws-title">
            Al je marketing. Eén slimme werkruimte.
          </h2>
          <p className="hs-lead">Geen losse tools, logins en spreadsheets meer. Je reviews, posts, mails, klantgesprekken en resultaten staan bij elkaar, en Mavix weet hoe ze samenhangen.</p>
        </Reveal>
        <Reveal className="ws-shell">
          <div className="ws-tabs" role="tablist" aria-label="Onderdelen van Mavix" aria-orientation="vertical">
            {MODULES.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={"ws-tab-" + x.id}
                aria-selected={i === active}
                aria-controls="ws-panel"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
                  if (!next) return;
                  e.preventDefault();
                  const n = (i + next + MODULES.length) % MODULES.length;
                  setActive(n);
                  document.getElementById("ws-tab-" + MODULES[n].id)?.focus();
                }}
              >
                <x.icon size={16} aria-hidden="true" />
                {x.label}
              </button>
            ))}
          </div>
          <div className="ws-window" role="tabpanel" id="ws-panel" aria-labelledby={"ws-tab-" + m.id}>
            <div className="ws-window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>mavix · {m.label}</span>
            </div>
            <div className="ws-window-body" key={m.id}>
              <div className="ws-copy">
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </div>
              <div className="ws-preview">{m.preview}</div>
            </div>
            <span className="hs-sample">Vereenvoudigde weergave</span>
          </div>
        </Reveal>
        <Reveal className="ws-why">
          <div>
            <strong>Minder handwerk</strong>
            <p>Mavix bereidt het werk voor; jij kijkt het na. Dat scheelt typen, kopiëren en schakelen tussen apps.</p>
          </div>
          <div>
            <strong>Eén merkverhaal</strong>
            <p>Elke post, mail en reactie vertrekt vanuit dezelfde Brand Hub. Zo klinkt je bedrijf overal hetzelfde.</p>
          </div>
          <div>
            <strong>Overzicht in plaats van losse eindjes</strong>
            <p>Wat gepland staat, wat wacht en wat werkte, zie je op één plek in plaats van in vijf apps.</p>
          </div>
        </Reveal>
        <p className="ws-more">
          <Link href="#functies">
            Bekijk alle functies <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
