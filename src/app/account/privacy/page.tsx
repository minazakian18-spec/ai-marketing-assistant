"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { downloadFile } from "@/lib/download";
export default function PrivacyPage() {
  const { data, deleteAccount } = useWorkspace();
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [message, setMessage] = useState("");
  function download() {
    try {
      downloadFile(
        "mavix-gegevens.json",
        JSON.stringify(
          {
            exportVersion: 1,
            exportedAt: new Date().toISOString(),
            workspace: data,
          },
          null,
          2,
        ),
        "application/json",
      );
      setMessage("Je gegevens zijn gedownload als JSON-bestand.");
    } catch {
      setMessage("Downloaden is niet gelukt. Probeer opnieuw.");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="JIJ HOUDT DE CONTROLE"
        title="Privacy & data"
        description="Download je gegevens of verwijder je lokale account."
      />
      {deleted ? (
        <section className="panel deletion-success">
          <CheckCircle2 size={32} />
          <h2>Je lokale account is verwijderd</h2>
          <p>
            Je profiel, content, planning en instellingen zijn uit deze browser
            verwijderd.
          </p>
          <Link className="button primary" href="/">
            Naar de lege werkruimte
          </Link>
        </section>
      ) : (
        <>
          <section className="panel privacy-card">
            <div>
              <span className="privacy-icon">
                <Download size={23} />
              </span>
              <h2>Mijn gegevens downloaden</h2>
              <p>
                Ontvang je accountgegevens, profielfoto, bedrijfsprofiel,
                content, planning en instellingen in één JSON-bestand.
              </p>
            </div>
            <button className="button secondary" onClick={download}>
              <Download size={17} />
              Gegevens downloaden
            </button>
          </section>
          <section className="panel privacy-card danger-panel">
            <div>
              <span className="privacy-icon">
                <Trash2 size={23} />
              </span>
              <h2>Account verwijderen</h2>
              <p>
                Verwijder alle Mavix-gegevens uit deze browser. Dit kan niet
                ongedaan worden gemaakt. Download eerst een kopie als je je
                gegevens wilt bewaren.
              </p>
            </div>
            <button
              className="button danger-outline"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={17} />
              Account verwijderen
            </button>
          </section>
          <p className="field-note">
            Er is geen online account. Andere browsergegevens en eerder
            gedownloade bestanden blijven behouden.
          </p>
          <p role="status" className="success-message">
            {message}
          </p>
          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            title="Je lokale account verwijderen?"
            confirmLabel="Ja, account verwijderen"
            danger
            onConfirm={() => {
              if (deleteAccount()) {
                setConfirm(false);
                setDeleted(true);
                setMessage("");
              }
            }}
          >
            <p>
              Je persoonlijke gegevens, profielfoto, bedrijfsprofiel, alle
              posts, planning, integratiestatussen en meldingsvoorkeuren worden
              definitief verwijderd uit deze browser.
            </p>
            <p>Deze actie kan niet ongedaan worden gemaakt.</p>
          </ConfirmDialog>
        </>
      )}
    </>
  );
}
