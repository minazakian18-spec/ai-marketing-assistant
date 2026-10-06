import { ImageResponse } from "next/og";

// Share image for social media and messaging apps (1200x630), built from
// the Mavix mark and the product's real positioning.
export const alt = "Mavix — AI-marketingsoftware voor ondernemers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M3 15a4 4 0 0 1 1.8-3.3l2.7-1.8L13 17v12.5a4 4 0 0 1-1.8 3.3l-5.1 3.4A2 2 0 0 1 3 34.5V15Z" fill="#7752EF"/><path d="m17 14.4 6-3.9a2 2 0 0 1 3.1 1.7V30l-11-8.3v-3.9a4 4 0 0 1 1.9-3.4Z" fill="#A786FF"/><path d="M4.5 11.8 6.8 10a3 3 0 0 1 3.6.1l13.8 11a5 5 0 0 1 1.9 3.9v8.4a3 3 0 0 1-4.8 2.4L5 22.8a5.3 5.3 0 0 1-2-4.1v-3a5 5 0 0 1 1.5-3.9Z" fill="#5D3AD1"/><path d="m30.5 6.4 5.4-3.5A2 2 0 0 1 39 4.6v24.7a4 4 0 0 1-1.8 3.3l-5.1 3.5a2 2 0 0 1-3.1-1.7V9.7a4 4 0 0 1 1.5-3.3Z" fill="#9B76FF"/></svg>`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1e1240 0%, #3b1d8f 60%, #5b34d6 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={"data:image/svg+xml;utf8," + encodeURIComponent(MARK)} width={72} height={72} alt="" />
          <span style={{ fontSize: 44, fontWeight: 700 }}>Mavix</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.1 }}>Je marketingteam. In één werkruimte.</span>
          <span style={{ fontSize: 30, color: "#d9ccff" }}>AI voor Google-reviews, Instagram en e-mailmarketing</span>
        </div>
      </div>
    ),
    size,
  );
}
