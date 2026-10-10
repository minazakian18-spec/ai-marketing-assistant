"use client";
import { useState, type ChangeEvent } from "react";
import { Save, Camera, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
export function AccountForm() {
  const { data, save } = useWorkspace();
  const [account, setAccount] = useState(data.account);
  const [message, setMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage("");
    setPhotoError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setPhotoError("Kies een JPG, PNG of WebP van maximaal 1 MB.");
      return;
    }
    setLoadingPhoto(true);
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = value;
      await image.decode();
      setAccount((a) => ({ ...a, photo: value }));
    } catch {
      setPhotoError(
        "Deze afbeelding kon niet worden gelezen. Kies een ander bestand.",
      );
    } finally {
      setLoadingPhoto(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="Persoonlijk"
        title="Account en profiel"
        description="Je naam, foto en contactgegevens in Mavix."
      />
      <form
        onChange={() => setMessage("")}
        onSubmit={async (e) => {
          e.preventDefault();
          try { const response=await fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(account)});const result=await response.json();if(!response.ok)throw new Error(result.error); } catch(error) {setMessage(error instanceof Error?error.message:"Profiel opslaan mislukt.");return;}
          if (await save({ ...data, account }, "Je gegevens zijn opgeslagen"))
            setMessage("Je gegevens zijn opgeslagen.");
        }}
      >
        <section className="panel account-panel">
          <div className="section-heading">
            <div>
              <h2>Persoonlijke gegevens</h2>
              <p>Zo herkennen we jou in je werkruimte.</p>
            </div>
          </div>
          <div className="account-panel-body">
            <div className="photo-editor">
              <span className="account-photo">
                {account.photo ? (
                  <img src={account.photo} alt="Jouw profielfoto" />
                ) : (
                  <Camera size={26} />
                )}
              </span>
              <div>
                <label className="photo-upload">
                  Profielfoto
                  <input
                    disabled={loadingPhoto}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={upload}
                  />
                </label>
                <p className="field-note">JPG, PNG of WebP · maximaal 1 MB</p>
                {account.photo && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setAccount({ ...account, photo: "" });
                      setMessage("");
                    }}
                  >
                    Foto verwijderen
                  </button>
                )}
              </div>
            </div>
            <p role="alert" className="field-error">
              {photoError}
            </p>
            <div className="account-fields">
              {(
                [
                  ["firstName", "Voornaam", "text", "given-name"],
                  ["lastName", "Achternaam", "text", "family-name"],
                  ["email", "E-mailadres", "email", "email"],
                  ["phone", "Telefoonnummer", "tel", "tel"],
                ] as const
              ).map(([key, label, type, autocomplete]) => (
                <label key={key}>
                  {label}
                  <input
                    readOnly={key === "email"}
                    type={type}
                    autoComplete={autocomplete}
                    maxLength={250}
                    value={account[key]}
                    onChange={(e) =>
                      setAccount({ ...account, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
        <Link href="/account/bedrijf" className="panel account-panel st-crosslink">
          <Building2 size={18} aria-hidden="true" />
          <span>
            <strong>Bedrijfsgegevens</strong>
            <small>Bedrijfsnaam, adres en btw-nummer staan nu onder Bedrijfsinstellingen.</small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className="account-save">
          <p role="status" className="success-message">
            {message}
          </p>
          <button disabled={loadingPhoto} className="button primary">
            <Save size={17} />
            {loadingPhoto ? "Foto laden…" : "Gegevens opslaan"}
          </button>
        </div>
      </form>
    </>
  );
}
