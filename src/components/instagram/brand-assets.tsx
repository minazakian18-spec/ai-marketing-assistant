"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { readImages } from "@/lib/local-images";
export function BrandAssets() {
  const { data, ready, save } = useWorkspace();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel ig-brand-assets">
      <div className="section-heading">
        <div>
          <h2>Bronnen voor Mavix Autopilot</h2>
          <p>Vul je marketinggeheugen aan. Deze gegevens blijven lokaal.</p>
        </div>
      </div>
      {ready && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            if (
              await save({
                ...data,
                profile: {
                  ...data.profile,
                  products: String(fields.get("products") || ""),
                  offers: String(fields.get("offers") || ""),
                  contentPreferences: String(
                    fields.get("contentPreferences") || "",
                  ),
                  website: String(fields.get("website") || ""),
                },
              })
            )
              setMessage("Merkbronnen opgeslagen.");
          }}
        >
          <div className="ig-two-fields">
            <label>
              Producten/diensten
              <textarea
                name="products"
                defaultValue={data.profile.products || ""}
                rows={4}
                maxLength={3000}
                placeholder="Eén bestaand product of dienst per regel"
              />
            </label>
            <label>
              Contentvoorkeuren
              <textarea
                name="contentPreferences"
                defaultValue={data.profile.contentPreferences || ""}
                rows={4}
                maxLength={2000}
                placeholder="Welke onderwerpen passen bij jouw merk?"
              />
            </label>
          </div>
          <label>
            Bestaande aanbiedingen
            <textarea
              name="offers"
              defaultValue={data.profile.offers || ""}
              rows={3}
              maxLength={2000}
              placeholder="Eén bevestigde aanbieding per regel, inclusief voorwaarden"
            />
          </label>
          <label>
            Website
            <input
              name="website"
              type="url"
              defaultValue={data.profile.website}
              placeholder="https://jouwbedrijf.nl"
            />
          </label>
          <div className="ig-two-fields">
            <div>
              <label>
                Bedrijfslogo
                <input
                  type="file"
                  disabled={busy}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    if (!files.length) return;
                    setBusy(true);
                    try {
                      const [logo] = await readImages(files, 1);
                      if (await save({ ...data, profile: { ...data.profile, logo } }))
                        setMessage("Logo opgeslagen.");
                    } catch (error) {
                      setMessage(String(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              {data.profile.logo && (
                <div className="ig-brand-logo">
                  <img src={data.profile.logo} alt="Bedrijfslogo" />
                  <button
                    type="button"
                    onClick={async () =>
                      await save({ ...data, profile: { ...data.profile, logo: "" } })
                    }
                  >
                    Verwijderen
                  </button>
                </div>
              )}
            </div>
            <div>
              <label>
                Bedrijfsfoto’s
                <input
                  type="file"
                  multiple
                  disabled={busy}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    if (!files.length) return;
                    setBusy(true);
                    try {
                      const media = await readImages(files);
                      if (
                        await save({ ...data, profile: { ...data.profile, media } })
                      )
                        setMessage("Bedrijfsfoto’s opgeslagen.");
                    } catch (error) {
                      setMessage(String(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <p className="field-note">
                Maximaal 4 foto’s, 500 KB per bestand. Een nieuwe selectie
                vervangt de vorige.
              </p>
              <div className="ig-photo-strip">
                {data.profile.media?.map((p, i) => (
                  <div key={i}>
                    <img src={p} alt={"Bedrijfsfoto " + (i + 1)} />
                    <button
                      type="button"
                      aria-label={"Verwijder bedrijfsfoto " + (i + 1)}
                      onClick={async () =>
                        await save({
                          ...data,
                          profile: {
                            ...data.profile,
                            media: data.profile.media?.filter(
                              (_, n) => n !== i,
                            ),
                          },
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ig-settings-footer">
            <p role="status">{message}</p>
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              Merkbronnen opslaan
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
