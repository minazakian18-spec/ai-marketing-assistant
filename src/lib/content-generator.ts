import type { Post, Profile } from "./types";
export function generateMock(
  prompt: string,
  profile: Profile,
  variant = 0,
): Post {
  const intro = [
    "Even iets leuks voor je tijdlijn ✨",
    "Een goed moment om iets nieuws te ontdekken 💫",
    "Dit wil je niet missen 🌟",
  ][variant % 3];
  return {
    id: crypto.randomUUID(),
    prompt,
    caption: `${intro}\n\nBij ${profile.name || "ons bedrijf"} maken we graag ruimte voor mooie momenten.\n\n${prompt}\n\nBenieuwd? Kom langs of laat het ons weten in de reacties!`,
    hashtags: `#${(profile.name || "jouwbedrijf").replace(/[^a-zA-Z0-9]/g, "") || "jouwbedrijf"} #inspiratie #ontdekmeer #supportlocal`,
    status: "draft",
    date: "",
    createdAt: new Date().toISOString(),
    variant,
  };
}
