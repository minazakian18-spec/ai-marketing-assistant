import type { Profile } from "../types";
import { buildBrandContext, type BrandContext } from "./brand-context.ts";
import {
  categorize,
  type Review,
  type ReviewAutoReplySettings,
  type ReviewCategory,
} from "../review-model.ts";

export type ReviewInstruction = {
  brand: BrandContext;
  category: ReviewCategory;
  rating: number;
  reviewText: string;
  tone: string;
  signature: string;
};

export function buildReviewInstruction(
  profile: Profile,
  review: Pick<Review, "rating" | "text">,
  settings: ReviewAutoReplySettings,
): ReviewInstruction {
  return {
    brand: buildBrandContext(profile),
    category: categorize(review),
    rating: review.rating,
    reviewText: review.text,
    tone: settings.tone,
    signature: settings.signature,
  };
}
