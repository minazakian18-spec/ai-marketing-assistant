import type { LucideIcon } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";

// The original Instagram and Gmail logos as drop-in replacements for the
// lucide line icons (same `size` prop), so channels look like the real apps.
type Props = { size?: number | string; className?: string; "aria-label"?: string; "aria-hidden"?: boolean | "true" | "false" };

function InstagramMark({ size = 18, className, ...rest }: Props) {
  return <BrandIcon brand="instagram" size={Number(size) || 18} className={className} title={rest["aria-label"] ?? "Instagram"} />;
}

function GmailMark({ size = 18, className, ...rest }: Props) {
  return <BrandIcon brand="gmail" size={Number(size) || 18} className={className} title={rest["aria-label"] ?? "Gmail"} />;
}

// Typed as lucide icons so they fit every icon slot that took the line icons.
export const InstagramLogo = InstagramMark as unknown as LucideIcon;
export const GmailLogo = GmailMark as unknown as LucideIcon;
