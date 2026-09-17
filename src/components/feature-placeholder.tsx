import type { LucideIcon } from "lucide-react";
export function FeaturePlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <section className="panel feature-placeholder">
      <span className="empty-icon">
        <Icon size={23} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="badge draft">Binnenkort</span>
    </section>
  );
}
