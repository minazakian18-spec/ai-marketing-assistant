import type { ContentProviders, GenerationRequest } from "./contracts";
import type { Post } from "../types";
export const mockProviders: ContentProviders = {
  text: {
    async generate(r) {
      const intro = [
        "Een nieuw verhaal begint hier. ✨",
        "Een kijkje in ons verhaal. 💜",
        "Tijd voor een nieuw perspectief. ✨",
      ][r.variant % 3];
      const context = [
        r.product ? "Product/dienst: " + r.product : "",
        r.useWebsite
          ? "Opgeslagen bedrijfsomschrijving: " +
            (r.profile.description || "Nog niet ingevuld")
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        caption:
          r.type === "Content Ideas"
            ? "1. Laat je product of dienst zien.\n2. Deel een kijkje achter de schermen.\n3. Beantwoord een veelgestelde vraag.\n\nJouw richting: " +
              r.prompt
            : intro +
              "\n\n" +
              r.prompt +
              (context ? "\n\n" + context : "") +
              "\n\n" +
              (r.profile.name || "Jouw bedrijf"),
        hashtags: "#jouwverhaal #inspiratie #achterdeschermen",
      };
    },
  },
  image: {
    async generate(r) {
      return { images: r.photos, placeholder: !r.photos.length };
    },
  },
  video: {
    async generate(r) {
      return {
        storyboard: [
          "Intro: laat je beeld zien",
          "Verhaal: voeg een korte tekst toe",
          "Afsluiting: een duidelijke CTA",
        ],
        duration: r.duration,
        format: "9:16",
        mock: true,
      };
    },
  },
};
export async function generateContent(
  r: GenerationRequest,
  providers: ContentProviders = mockProviders,
): Promise<Post> {
  const text = await providers.text.generate(r);
  const image = await providers.image.generate(r);
  const video = ["Reel", "Animate Image", "Photos to Reel"].includes(r.type)
    ? await providers.video.generate(r)
    : undefined;
  return {
    id: crypto.randomUUID(),
    prompt: r.prompt,
    caption: text.caption,
    hashtags: text.hashtags,
    status: "draft",
    date: "",
    createdAt: new Date().toISOString(),
    variant: r.variant,
    contentType: r.type,
    source: "manual",
    media: image.images,
    videoMode: r.videoMode,
    duration: video?.duration,
  };
}
