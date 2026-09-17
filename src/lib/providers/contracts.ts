import type { ContentType } from "../instagram-model";
import type { Profile } from "../types";
export type GenerationRequest = {
  prompt: string;
  type: ContentType;
  profile: Profile;
  product: string;
  useWebsite: boolean;
  photos: string[];
  duration: 5 | 10;
  videoMode: string;
  variant: number;
};
export interface TextProvider {
  generate(
    request: GenerationRequest,
  ): Promise<{ caption: string; hashtags: string }>;
}
export interface ImageProvider {
  generate(
    request: GenerationRequest,
  ): Promise<{ images: string[]; placeholder: boolean }>;
}
export interface VideoProvider {
  generate(
    request: GenerationRequest,
  ): Promise<{
    storyboard: string[];
    duration: number;
    format: "9:16";
    mock: true;
  }>;
}
export type ContentProviders = {
  text: TextProvider;
  image: ImageProvider;
  video: VideoProvider;
};
