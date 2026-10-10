import { Mavi } from "@/components/mavi";

export function GenerationSkeleton({ email = false }: { email?: boolean }) {
  return (
    <div className={"generation-skeleton " + (email ? "email-skeleton" : "")} role="status" aria-live="polite">
      <div className="generation-label">
        <Mavi size={22} state="thinking" tone="brand" live />
        <strong>Mavix AI schrijft je {email ? "e-mail" : "content"}…</strong>
        <small>Op basis van je Brand Hub. Dit duurt meestal een paar seconden.</small>
      </div>
      <div className="skeleton-preview" aria-hidden="true">
        <span className="skeleton-line short" />
        {!email && <span className="skeleton-media" />}
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line medium" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
        <span className="skeleton-cta" />
      </div>
    </div>
  );
}
/** Give the local mock a brief, stable loading state without delaying real providers. */
export async function previewMock<T>(result: Promise<T>): Promise<T> {
  const [value] = await Promise.all([result, new Promise<void>((resolve) => setTimeout(resolve, 450))]);
  return value;
}
