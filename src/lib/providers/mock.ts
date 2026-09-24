import type { ContentProviders, GenerationRequest } from "./contracts";
import type { Post } from "../types";
import {
  buildInstagramInstruction,
  isInstagramGoal,
  type InstagramGoal,
} from "../ai/instagram-instruction.ts";

const goalIntros: Record<InstagramGoal, string[]> = {
  "product-promotie": [
    "Ontdek wat dit voor jou kan betekenen. ✨",
    "Hier is iets moois voor je. 💜",
  ],
  aanbieding: ["Tijdelijk extra voordelig. 🔥", "Mis dit niet. ⏰"],
  merkbekendheid: [
    "Dit zijn wij. ✨",
    "Een kijkje in ons verhaal. 💜",
    "Tijd voor een nieuw perspectief. ✨",
  ],
  informatief: ["Goed om te weten: 📌", "Even dit delen: 💡"],
  educatief: ["Vandaag leggen we uit: 📚", "Zo werkt het: 💡"],
  seizoensgebonden: ["Het seizoen is aangebroken. 🍂", "Helemaal klaar voor dit moment. ✨"],
  evenement: ["Zet het in je agenda. 📅", "We zien je daar graag. ✨"],
  "nieuw-product": ["Gloednieuw. ✨", "Voor het eerst te zien: 👀"],
  testimonial: ["In de woorden van een klant: 💬", "Dit raakte ons echt. 💜"],
  engagement: ["Wij zijn benieuwd: 💬", "Vertel het ons: 👇"],
};

export const mockProviders: ContentProviders = {
  text: {
    async generate(r) {
      const goal = isInstagramGoal(r.goal || "") ? (r.goal as InstagramGoal) : "merkbekendheid";
      const instruction = buildInstagramInstruction({
        profile: r.profile,
        prompt: r.prompt,
        type: r.type,
        goal,
        product: r.product,
        segmentId: r.segmentId,
        cta: r.cta,
        useWebsite: r.useWebsite,
      });
      const intros = goalIntros[instruction.goal];
      const intro = intros[r.variant % intros.length];
      const context = [
        instruction.product
          ? "Product/dienst: " + instruction.product.name
          : r.product
            ? "Product/dienst: " + r.product
            : "",
        instruction.segment ? "Specifiek voor: " + instruction.segment.name : "",
        instruction.useWebsite
          ? "Opgeslagen bedrijfsomschrijving: " +
            (r.profile.description || "Nog niet ingevuld")
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const ctaLine = instruction.cta ? "\n\n" + instruction.cta : "";
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
              (r.profile.name || "Jouw bedrijf") +
              ctaLine,
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
