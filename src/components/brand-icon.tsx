import {
  siGmail,
  siGoogle,
  siGoogleads,
  siGooglecalendar,
  siGooglesearchconsole,
  siInstagram,
  siMessenger,
  siMeta,
  siShopify,
  siWhatsapp,
  type SimpleIcon,
} from "simple-icons";

import type React from "react";

// Recognisable brand marks for channels and integrations: simple-icons (CC0)
// for the shapes, multicolour where the brand's identity is multicolour (see
// MULTI). Used only to identify the service a feature connects to.
// LinkedIn asked simple-icons to remove its logo, so it gets a plain
// monogram in its brand colour instead.
export type Brand =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "gmail"
  | "google_calendar"
  | "google_business"
  | "google_reviews"
  | "google_ads"
  | "search_console"
  | "linkedin"
  | "shopify"
  | "meta_ads";

const ICONS: Partial<Record<Brand, SimpleIcon>> = {
  whatsapp: siWhatsapp,
  instagram: siInstagram,
  messenger: siMessenger,
  gmail: siGmail,
  google_calendar: siGooglecalendar,
  google_business: siGoogle,
  google_reviews: siGoogle,
  google_ads: siGoogleads,
  search_console: siGooglesearchconsole,
  shopify: siShopify,
  meta_ads: siMeta,
};

export const BRAND_LABEL: Record<Brand, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  gmail: "Gmail",
  google_calendar: "Google Agenda",
  google_business: "Google Bedrijfsprofiel",
  google_reviews: "Google Reviews",
  google_ads: "Google Ads",
  search_console: "Search Console",
  linkedin: "LinkedIn",
  shopify: "Shopify",
  meta_ads: "Meta Ads",
};

// Brands whose recognisable identity is multicolour. The Google "G" and the
// Gmail "M" use Google's brand colours (#4285F4, #EA4335, #FBBC05/#FBBC04,
// #34A853); Instagram and Messenger keep the simple-icons outline and get
// their official gradient. Everything is inline: no runtime downloads.
// Gradient ids are fixed per brand (identical definitions, so a repeat on a
// page renders the same).
const GOOGLE_G = (
  <>
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.13 2.74-2.39 3.59l3.86 3c2.26-2.09 3.55-5.18 3.55-8.83Z" />
    <path fill="#FBBC05" d="M5.27 14.29A7.15 7.15 0 0 1 4.89 12c0-.8.14-1.57.38-2.29l-3.99-3.1A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.99-3.1Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.86-3c-1.08.72-2.46 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96l-3.99 3.1C3.26 21.31 7.31 24 12 24Z" />
  </>
);
const MULTI: Partial<Record<Brand, { viewBox: string; body: React.ReactNode }>> = {
  google_business: { viewBox: "0 0 24 24", body: GOOGLE_G },
  google_reviews: { viewBox: "0 0 24 24", body: GOOGLE_G },
  gmail: {
    viewBox: "52 42 88 66",
    body: (
      <>
        <path fill="#4285F4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
        <path fill="#34A853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
        <path fill="#FBBC04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
        <path fill="#EA4335" d="M72 74V48l24 18 24-18v26L96 92" />
        <path fill="#C5221F" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
      </>
    ),
  },
  instagram: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <defs>
          <radialGradient id="bi-instagram" cx="0.3" cy="1.07" r="1.3">
            <stop offset="0" stopColor="#FFDD55" />
            <stop offset="0.12" stopColor="#FFDD55" />
            <stop offset="0.45" stopColor="#FF543E" />
            <stop offset="0.7" stopColor="#C837AB" />
            <stop offset="1" stopColor="#5851DB" />
          </radialGradient>
        </defs>
        <path fill="url(#bi-instagram)" d={siInstagram.path} />
      </>
    ),
  },
  messenger: {
    viewBox: "0 0 24 24",
    body: (
      <>
        <defs>
          <radialGradient id="bi-messenger" cx="0.19" cy="0.99" r="1.09">
            <stop offset="0" stopColor="#0099FF" />
            <stop offset="0.61" stopColor="#A033FF" />
            <stop offset="0.93" stopColor="#FF5280" />
            <stop offset="1" stopColor="#FF7061" />
          </radialGradient>
        </defs>
        <path fill="url(#bi-messenger)" d={siMessenger.path} />
      </>
    ),
  },
};

export function BrandIcon({
  brand,
  size = 18,
  title,
  className = "",
}: {
  brand: Brand;
  size?: number;
  title?: string;
  className?: string;
}) {
  const icon = ICONS[brand];
  const label = title ?? BRAND_LABEL[brand];
  const multi = MULTI[brand];
  if (multi)
    return (
      <svg className={"brand-mark " + className} width={size} height={size} viewBox={multi.viewBox} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {multi.body}
      </svg>
    );
  if (!icon)
    return (
      <svg className={"brand-mark " + className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
          in
        </text>
      </svg>
    );
  return (
    <svg className={"brand-mark " + className} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={icon.path} fill={"#" + icon.hex} />
    </svg>
  );
}
