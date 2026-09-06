"use client";
import { useEffect, useState } from "react";
import { Building2, Check, Save } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
export default function ProfilePage() {
  const { data, ready, save } = useWorkspace();
  const [form, setForm] = useState(data.profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (ready) setForm(data.profile);
  }, [ready, data.profile]);
  return (
    <>
      <PageHeading
        eyebrow="DE BASIS VAN JE MERK"
        title="Bedrijfsprofiel"
        description="Geef je content een herkenbare stem. Begin bij jouw bedrijf."
      />
      <div className="profile-layout">
        <form
          className="panel profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(save({ ...data, profile: form }));
          }}
        >
          <div className="section-heading">
            <div>
              <h2>Vertel over je bedrijf</h2>
              <p>Je kunt deze gegevens op elk moment aanpassen.</p>
            </div>
            <Building2 size={22} />
          </div>
          {(
            [
              ["name", "Bedrijfsnaam", "Bijvoorbeeld: Studio Bloom"],
              ["industry", "Branche", "Bijvoorbeeld: Lifestyle & interieur"],
              ["audience", "Doelgroep", "Voor wie maak je het verschil?"],
              [
                "description",
                "Bedrijfsomschrijving",
                "Wat doe je en wat maakt jouw bedrijf bijzonder?",
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key}>
              {label}
              {key === "description" ? (
                <textarea
                  rows={5}
                  maxLength={3000}
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setSaved(false);
                  }}
                />
              ) : (
                <input
                  required={key === "name"}
                  maxLength={300}
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setSaved(false);
                  }}
                />
              )}
            </label>
          ))}
          <label>
            Tone of voice
            <select
              value={form.voice}
              onChange={(e) => {
                setForm({ ...form, voice: e.target.value });
                setSaved(false);
              }}
            >
              {[
                "Persoonlijk en enthousiast",
                "Professioneel en helder",
                "Speels en creatief",
                "Warm en betrokken",
                "Kort en direct",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="form-bottom">
            <span role="status">
              {saved ? (
                <>
                  <Check size={16} /> Profiel opgeslagen
                </>
              ) : (
                "Alleen opgeslagen in deze browser."
              )}
            </span>
            <button disabled={!ready} className="button primary">
              <Save size={17} />
              Opslaan
            </button>
          </div>
        </form>
        <aside className="profile-note">
          <span className="note-icon">✦</span>
          <h2>
            Goede content
            <br />
            begint bij jou.
          </h2>
          <p>
            Een helder profiel helpt je om consistent te vertellen wie je bent
            en waar je voor staat.
          </p>
          <hr />
          <strong>Een kleine tip</strong>
          <p>
            Beschrijf je doelgroep alsof je één klant voor je hebt. Dat maakt je
            boodschap een stuk persoonlijker.
          </p>
          <span className="badge draft">Lokale werkruimte</span>
        </aside>
      </div>
    </>
  );
}
