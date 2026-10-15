import { Construction } from "lucide-react";

type PagePlaceholderProps = {
  title: string;
  description: string;
  phase: number;
};

// Temporary content for screens that are built in later phases.
export function PagePlaceholder({
  title,
  description,
  phase,
}: PagePlaceholderProps) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">{title}</h1>
      <div className="rounded-card border border-line bg-card p-5">
        <div className="flex items-start gap-3">
          <Construction
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-warning"
          />
          <div>
            <p className="text-ink">{description}</p>
            <p className="mt-2 text-sm text-muted">
              This screen is built in phase {phase}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
