"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { SegmentFormDialog } from "./segment-form-dialog";
import { audienceTypeLabel, type AudienceSegment } from "@/lib/brand-model";

export function SegmentsManager() {
  const { data, ready, save } = useWorkspace();
  const segments = data.profile.segments || [];
  const [editing, setEditing] = useState<AudienceSegment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AudienceSegment | null>(null);
  const [message, setMessage] = useState("");

  function persist(next: AudienceSegment[], text: string) {
    if (save({ ...data, profile: { ...data.profile, segments: next } }))
      setMessage(text);
  }

  return (
    <section className="panel brand-section">
      <div className="section-heading">
        <div>
          <h2>Doelgroepsegmenten</h2>
          <p>
            Beschrijf je klantgroepen apart, zodat Mavix content op het juiste
            segment kan afstemmen.
          </p>
        </div>
        <Users size={22} />
      </div>
      {ready && segments.length > 0 && (
        <div className="brand-card-grid">
          {segments.map((s) => (
            <article key={s.id} className="panel brand-card">
              <div className="brand-card-head">
                <div>
                  <h3>{s.name}</h3>
                  <span className="lib-type-tag">{audienceTypeLabel[s.type]}</span>
                </div>
                <div className="brand-card-actions">
                  <button
                    type="button"
                    aria-label={"Bewerk " + s.name}
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={"Verwijder " + s.name}
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {(s.ageRange || s.location) && (
                <p className="brand-card-meta">
                  {[s.ageRange, s.location].filter(Boolean).join(" · ")}
                </p>
              )}
              {s.whyTheyChoose && <p>{s.whyTheyChoose}</p>}
            </article>
          ))}
        </div>
      )}
      {ready && segments.length === 0 && (
        <p className="field-note">
          Nog geen segmenten toegevoegd. Voeg er minimaal één toe, bijvoorbeeld
          "Jonge professionals" of "Zakelijke klanten".
        </p>
      )}
      <div className="ig-settings-footer">
        <p role="status">{message}</p>
        <button
          type="button"
          className="button primary"
          disabled={!ready}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Segment toevoegen
        </button>
      </div>
      <SegmentFormDialog
        open={formOpen}
        segment={editing}
        onClose={() => setFormOpen(false)}
        onSave={(segment) => {
          const exists = segments.some((s) => s.id === segment.id);
          persist(
            exists
              ? segments.map((s) => (s.id === segment.id ? segment : s))
              : [...segments, segment],
            exists ? "Segment bijgewerkt." : "Segment toegevoegd.",
          );
          setFormOpen(false);
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Segment verwijderen?"
        confirmLabel="Verwijderen"
        danger
        onConfirm={() => {
          if (!deleteTarget) return;
          persist(
            segments.filter((s) => s.id !== deleteTarget.id),
            "'" + deleteTarget.name + "' is verwijderd.",
          );
          setDeleteTarget(null);
        }}
      >
        <p>
          Weet je zeker dat je "{deleteTarget?.name}" wilt verwijderen? Dit kan
          niet ongedaan worden gemaakt.
        </p>
      </ConfirmDialog>
    </section>
  );
}
