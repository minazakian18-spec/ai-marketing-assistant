"use client";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import {
  audienceTypeLabel,
  type AudienceSegment,
  type AudienceType,
} from "@/lib/brand-model";

export function SegmentFormDialog({
  open,
  segment,
  onClose,
  onSave,
}: {
  open: boolean;
  segment?: AudienceSegment | null;
  onClose: () => void;
  onSave: (segment: AudienceSegment) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AudienceType>("B2C");
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState("");
  const [problems, setProblems] = useState("");
  const [goals, setGoals] = useState("");
  const [whyTheyChoose, setWhyTheyChoose] = useState("");
  const [pricePositioning, setPricePositioning] = useState("");
  const [buyingBehavior, setBuyingBehavior] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(segment?.name || "");
    setType(segment?.type || "B2C");
    setAgeRange(segment?.ageRange || "");
    setLocation(segment?.location || "");
    setInterests(segment?.interests || "");
    setProblems(segment?.problems || "");
    setGoals(segment?.goals || "");
    setWhyTheyChoose(segment?.whyTheyChoose || "");
    setPricePositioning(segment?.pricePositioning || "");
    setBuyingBehavior(segment?.buyingBehavior || "");
    setError("");
  }, [open, segment]);
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={segment ? "Doelgroepsegment bewerken" : "Doelgroepsegment toevoegen"}
      confirmLabel={segment ? "Wijzigingen opslaan" : "Segment toevoegen"}
      onConfirm={async () => {
        if (!name.trim()) {
          setError("Geef dit segment een naam, bijvoorbeeld 'Jonge professionals'.");
          return;
        }
        await onSave({
          id: segment?.id || crypto.randomUUID(),
          name: name.trim(),
          type,
          ageRange: ageRange.trim(),
          location: location.trim(),
          interests: interests.trim(),
          problems: problems.trim(),
          goals: goals.trim(),
          whyTheyChoose: whyTheyChoose.trim(),
          pricePositioning: pricePositioning.trim(),
          buyingBehavior: buyingBehavior.trim(),
        });
      }}
    >
      <label>
        Naam van dit segment
        <input
          value={name}
          maxLength={80}
          placeholder="Bijvoorbeeld: Jonge professionals"
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
      </label>
      {error && <p className="field-error">{error}</p>}
      <div className="ig-two-fields">
        <label>
          B2B, B2C of beide
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AudienceType)}
          >
            {(Object.keys(audienceTypeLabel) as AudienceType[]).map((t) => (
              <option key={t} value={t}>
                {audienceTypeLabel[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Leeftijdscategorie
          <input
            value={ageRange}
            maxLength={60}
            placeholder="Bijvoorbeeld: 25-40 jaar"
            onChange={(e) => setAgeRange(e.target.value)}
          />
        </label>
      </div>
      <div className="ig-two-fields">
        <label>
          Locatie
          <input
            value={location}
            maxLength={120}
            placeholder="Bijvoorbeeld: Nederland, vooral steden"
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label>
          Prijspositionering
          <input
            value={pricePositioning}
            maxLength={120}
            placeholder="Bijvoorbeeld: Middensegment"
            onChange={(e) => setPricePositioning(e.target.value)}
          />
        </label>
      </div>
      <label>
        Interesses
        <textarea
          value={interests}
          rows={2}
          maxLength={500}
          placeholder="Waar is dit segment in geïnteresseerd?"
          onChange={(e) => setInterests(e.target.value)}
        />
      </label>
      <div className="ig-two-fields">
        <label>
          Problemen van deze klant
          <textarea
            value={problems}
            rows={2}
            maxLength={500}
            onChange={(e) => setProblems(e.target.value)}
          />
        </label>
        <label>
          Doelen van deze klant
          <textarea
            value={goals}
            rows={2}
            maxLength={500}
            onChange={(e) => setGoals(e.target.value)}
          />
        </label>
      </div>
      <label>
        Waarom kiezen zij voor jou?
        <textarea
          value={whyTheyChoose}
          rows={2}
          maxLength={500}
          onChange={(e) => setWhyTheyChoose(e.target.value)}
        />
      </label>
      <label>
        Koopgedrag
        <textarea
          value={buyingBehavior}
          rows={2}
          maxLength={500}
          placeholder="Hoe en wanneer kopen zij typisch?"
          onChange={(e) => setBuyingBehavior(e.target.value)}
        />
      </label>
    </ConfirmDialog>
  );
}
