"use client";
import { useState } from "react";
import { Globe, ScanSearch } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";

export function WebsiteImport() {
  const { data } = useWorkspace();
  const [url, setUrl] = useState(data.profile.website || "");
  const [message, setMessage] = useState("");

  return (
    <section className="panel brand-section">
      <div className="section-heading">
        <div>
          <h2>Producten importeren vanaf je website</h2>
          <p>
            Voer je website in. Mavix toont een overzicht ter goedkeuring
            voordat er iets wordt opgeslagen — er wordt nooit automatisch
            geïmporteerd.
          </p>
        </div>
        <Globe size={22} />
      </div>
      <div className="ig-two-fields">
        <label>
          Website-URL
          <input
            type="url"
            value={url}
            placeholder="https://jouwbedrijf.nl"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>
      <div className="ig-settings-footer">
        <p role="status">{message}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setMessage(
              "Website scannen vereist een actieve backend-koppeling die nog niet is aangesloten. Voeg producten voorlopig handmatig toe hierboven; deze knop krijgt dezelfde goedkeuringsstap zodra de koppeling actief is.",
            )
          }
        >
          <ScanSearch size={16} />
          Website scannen
        </button>
      </div>
    </section>
  );
}
