import { Artwork } from "@/components/ui";
import type { Post } from "@/lib/types";
export function PostVisual({
  post,
  small = false,
}: {
  post: Post;
  small?: boolean;
}) {
  return post.media?.[0] ? (
    <img
      className={small ? "ig-thumb" : "ig-preview-photo"}
      src={post.media[0]}
      alt="Gekozen contentafbeelding"
    />
  ) : (
    <Artwork small={small} variant={post.variant} />
  );
}
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="ig-toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
