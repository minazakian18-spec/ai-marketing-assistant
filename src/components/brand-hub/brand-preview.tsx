"use client";
import { Heart, MessageCircle, Send } from "lucide-react";
import type { Profile } from "@/lib/types";
import { HEX, strategyOf, typeStack, TONE_PRESETS, voiceOf } from "@/lib/brand-strategy";

// Live preview of the brand: an Instagram post and an e-mail header built from
// the current (unsaved) Brand Hub settings. Texts are either the AI preview
// the owner asked for, or the fixed example sentence of the chosen tone.

export type PreviewText = { instagram: string; email: string } | null;

export function BrandPreview({ profile, ai, compact = false }: { profile: Profile; ai?: PreviewText; compact?: boolean }) {
  const s = strategyOf(profile);
  const v = voiceOf(profile);
  const colors = v.colors.filter((c) => HEX.test(c));
  const primary = colors[0] || "#6d28d9";
  const secondary = colors[1] || "#f3effd";
  const preset = TONE_PRESETS.find((t) => t.id === s.tonePreset);
  const caption = ai?.instagram || preset?.example || "Kies een toon om te horen hoe je merk klinkt.";
  const name = profile.name.trim() || "Jouw bedrijf";
  const heading = typeStack(s.typography.heading);
  const body = typeStack(s.typography.body || s.typography.heading);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (
    <div className={"bh-preview" + (compact ? " is-compact" : "")} aria-label="Voorbeeld van je merk">
      <div className="bh-post">
        <div className="bh-post-head">
          <span className="bh-avatar" style={{ background: profile.logo ? "#fff" : primary }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {profile.logo ? <img src={profile.logo} alt="" /> : <span style={{ color: "#fff" }}>{initials}</span>}
          </span>
          <strong>{name.toLowerCase().replace(/\s+/g, "")}</strong>
        </div>
        <div className="bh-post-image" style={{ background: `linear-gradient(140deg, ${primary}, ${secondary})` }}>
          {s.referenceImages[0] || profile.media?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.referenceImages[0] || profile.media![0]} alt="" />
          ) : (
            <span style={{ fontFamily: heading }}>{name}</span>
          )}
        </div>
        <div className="bh-post-actions" aria-hidden="true">
          <Heart size={16} />
          <MessageCircle size={16} />
          <Send size={16} />
        </div>
        <p className="bh-post-caption" style={{ fontFamily: body }}>
          <strong>{name.toLowerCase().replace(/\s+/g, "")}</strong> {caption}
        </p>
      </div>
      {!compact && (
        <div className="bh-mail">
          <div className="bh-mail-bar" style={{ background: primary }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {profile.logo ? <img src={profile.logo} alt="" /> : <span style={{ fontFamily: heading }}>{name}</span>}
          </div>
          <div className="bh-mail-body">
            <h4 style={{ fontFamily: heading, color: primary }}>Nieuws van {name}</h4>
            <p style={{ fontFamily: body }}>{ai?.email || "Zo ziet de bovenkant van je nieuwsbrief eruit, in jouw kleuren en lettertypes."}</p>
            {s.ctas[0] && (
              <span className="bh-mail-cta" style={{ background: primary }}>
                {s.ctas[0]}
              </span>
            )}
          </div>
        </div>
      )}
      {ai ? <p className="bh-preview-note">Voorbeeld geschreven door Mavi met je huidige instellingen.</p> : preset ? <p className="bh-preview-note">Voorbeeldzin bij de toon &quot;{preset.label}&quot;.</p> : null}
    </div>
  );
}
