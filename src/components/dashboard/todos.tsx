"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, ListChecks, PartyPopper } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";
import { todoProgress, type Todo } from "@/lib/dashboard-todos";

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const part = total ? done / total : 0;
  return (
    <span className="todo-ring" role="img" aria-label={`${done} van ${total} stappen afgerond`}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} className="todo-ring-track" />
        <circle cx="18" cy="18" r={r} className="todo-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - part)} />
      </svg>
      <span>
        {done}/{total}
      </span>
    </span>
  );
}

// A small task center: what needs you first, then the next onboarding steps.
export function DashboardTodos({ todos }: { todos: Todo[] }) {
  const [showDone, setShowDone] = useState(false);
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const { done: doneSteps, total } = todoProgress(todos);

  return (
    <Card className="dash-card todo-card">
      <SectionHeader
        title="Jouw to-do's"
        description={open.length ? "Je volgende stappen, op volgorde van belang." : "Alles staat klaar."}
        icon={<ListChecks size={16} />}
        action={<ProgressRing done={doneSteps} total={total} />}
      />
      {open.length ? (
        <ol className="todo-list">
          {open.map((t, i) => (
            <li key={t.id} className={"todo" + (t.urgent ? " is-urgent" : "")} style={{ ["--i" as string]: i }}>
              <span className="todo-mark" aria-hidden="true">
                {t.urgent ? <AlertTriangle size={14} /> : <span className="todo-dot" />}
              </span>
              <div className="todo-main">
                <strong>{t.title}</strong>
                <p>{t.detail}</p>
                {t.progress !== undefined && (
                  <span className="todo-progress" role="progressbar" aria-label={t.title} aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={100}>
                    <span className="todo-bar">
                      <span style={{ width: t.progress + "%" }} />
                    </span>
                    <em>{t.progress}%</em>
                  </span>
                )}
              </div>
              {t.cta && (
                <Link href={t.href} className="todo-cta">
                  {t.cta}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="todo-all-done">
          <span className="todo-all-done-icon" aria-hidden="true">
            <PartyPopper size={20} />
          </span>
          <div>
            <strong>Je bent helemaal bij</strong>
            <p>Mavi laat het je hier weten zodra er iets nieuws op je wacht.</p>
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div className="todo-done">
          <button type="button" className="todo-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <Check size={14} aria-hidden="true" />
            {done.length} afgerond
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {showDone && (
            <ul>
              {done.map((t) => (
                <li key={t.id}>
                  <span className="todo-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <Link href={t.href}>{t.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
