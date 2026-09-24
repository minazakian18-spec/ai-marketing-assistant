"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  X,
  Pencil,
  Copy,
  Trash2,
  Check,
  XCircle,
  CalendarClock,
  Sparkles,
  Instagram,
  Mail,
} from "lucide-react";
import { usePresence } from "@/components/use-presence";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { statusMeta, type CalendarItem } from "@/lib/calendar-data";
const channelIcon = { Instagram, "E-mail": Mail } as const;
export function CalendarDetailPanel({
  item,
  onClose,
  onApprove,
  onReject,
  onDuplicate,
  onDelete,
  onMove,
}: {
  item: CalendarItem | null;
  onClose: () => void;
  onApprove: (item: CalendarItem) => void;
  onReject: (item: CalendarItem) => void;
  onDuplicate: (item: CalendarItem) => void;
  onDelete: (item: CalendarItem) => void;
  onMove: (item: CalendarItem, date: string, time: string) => void;
}) {
  const open = !!item;
  const present = usePresence(open);
  const last = useRef<CalendarItem | null>(item);
  if (item) last.current = item;
  const shown = item || last.current;
  const [moving, setMoving] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (item) {
      setMoving(false);
      setMoveDate(item.date);
      setMoveTime(item.time || "18:00");
      closeRef.current?.focus();
    }
  }, [item]);
  useEffect(() => {
    if (!open) return;
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!present || !shown) return null;
  const Icon = channelIcon[shown.channel];
  const meta = statusMeta(shown.status);
  return (
    <>
      <div className="cal-panel-scrim" onClick={onClose} />
      <aside
        className="cal-panel"
        data-state={open ? "open" : "closed"}
        role="dialog"
        aria-modal="true"
        aria-label={shown.title}
      >
        <div className="cal-panel-head">
          <span className={"badge " + meta.className}>
            {shown.automated && <Sparkles size={12} />} {meta.label}
          </span>
          <button
            ref={closeRef}
            className="cal-panel-close"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="cal-panel-body">
          {shown.mediaUrl && (
            <img className="cal-panel-media" src={shown.mediaUrl} alt="" />
          )}
          <div className="cal-panel-field">
            Kanaal
            <strong>
              <Icon size={14} /> {shown.channel} · {shown.contentType}
            </strong>
          </div>
          <h2>{shown.title}</h2>
          {shown.caption && (
            <p className="cal-panel-caption">{shown.caption}</p>
          )}
          <div className="cal-panel-field">
            Datum en tijd
            <strong>
              {shown.date
                ? new Date(
                    shown.date + "T" + (shown.time || "00:00"),
                  ).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }) + (shown.time ? " · " + shown.time : "")
                : "Nog niet ingepland"}
            </strong>
          </div>
          <div className="cal-panel-field">
            Gemaakt door
            <strong>{shown.createdBy === "mavix-ai" ? "Mavix AI" : "Jou"}</strong>
          </div>
        </div>
        {moving && (
          <form
            className="cal-panel-move"
            onSubmit={(e) => {
              e.preventDefault();
              onMove(shown, moveDate, moveTime);
              setMoving(false);
            }}
          >
            <label>
              Nieuwe datum
              <input
                type="date"
                required
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
              />
            </label>
            <label>
              Tijd
              <input
                type="time"
                required
                value={moveTime}
                onChange={(e) => setMoveTime(e.target.value)}
              />
            </label>
            <button className="button primary">Verplaatsen</button>
          </form>
        )}
        <div className="cal-panel-actions">
          {shown.status === "review" && (
            <>
              <button
                className="button primary"
                onClick={() => onApprove(shown)}
              >
                <Check size={15} /> Goedkeuren
              </button>
              <button
                className="button secondary"
                onClick={() => onReject(shown)}
              >
                <XCircle size={15} /> Afwijzen
              </button>
            </>
          )}
          {shown.href && (
            <Link className="button secondary" href={shown.href}>
              <Pencil size={15} /> Bewerken
            </Link>
          )}
          <button
            className="button secondary"
            onClick={() => setMoving(!moving)}
          >
            <CalendarClock size={15} /> Verplaatsen
          </button>
          <button
            className="button secondary"
            onClick={() => onDuplicate(shown)}
          >
            <Copy size={15} /> Dupliceren
          </button>
          <button
            className="button secondary"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={15} /> Verwijderen
          </button>
        </div>
      </aside>
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Content verwijderen?"
        confirmLabel="Verwijderen"
        danger
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete(shown);
        }}
      >
        <p>
          Weet je zeker dat je “{shown.title}” wilt verwijderen? Dit kan niet
          ongedaan worden gemaakt.
        </p>
      </ConfirmDialog>
    </>
  );
}
