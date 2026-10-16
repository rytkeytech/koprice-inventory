import { BookOpen, Download } from "lucide-react";

/** Download link for the printable user guide (public/guides). */
export function GuideLink() {
  return (
    <a
      href="/guides/koprice-user-guide.pdf"
      download="Koprice user guide.pdf"
      className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-card px-4 py-3 hover:bg-bg"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-brand">
        <BookOpen aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">User guide (PDF)</span>
        <span className="block text-sm text-muted">How to sell, close the day, and use every screen</span>
      </span>
      <Download aria-hidden="true" className="size-5 text-muted" />
    </a>
  );
}
