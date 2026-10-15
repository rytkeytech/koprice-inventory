import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { StaffActions } from "./StaffActions";

export const metadata: Metadata = { title: "Staff" };

type StaffRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "owner" | "attendant" | null;
  is_active: boolean;
  created_at: string;
  approved_at: string | null;
  last_sign_in_at: string | null;
};

export default async function StaffPage() {
  const supabase = await createClient();
  const [{ data, error }, me] = await Promise.all([supabase.rpc("list_staff"), getCurrentUser()]);

  const staff = (data ?? []) as StaffRow[];
  const waiting = staff.filter((s) => !s.role);
  const active = staff.filter((s) => s.role && s.is_active);
  const turnedOff = staff.filter((s) => s.role && !s.is_active);

  return (
    <section className="space-y-6">
      <div>
        <Link
          href="/owner/settings"
          className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand"
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Settings
        </Link>
        <h1 className="text-2xl font-bold text-brand">Staff</h1>
        <p className="mt-1 text-muted">
          New people sign up on the login screen, then appear here for you to approve.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-control bg-danger/10 p-3 text-danger">
          Could not load staff. Please reload the page.
        </p>
      )}

      <StaffGroup title="Waiting for approval" empty="No one is waiting." people={waiting} meId={me?.id} highlight />
      <StaffGroup title="Staff" empty="No staff yet." people={active} meId={me?.id} />
      {turnedOff.length > 0 && (
        <StaffGroup title="Access turned off" empty="" people={turnedOff} meId={me?.id} />
      )}
    </section>
  );
}

function StaffGroup({
  title,
  empty,
  people,
  meId,
  highlight,
}: {
  title: string;
  empty: string;
  people: StaffRow[];
  meId?: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        {title}
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm ${
            highlight && people.length > 0 ? "bg-accent text-ink" : "bg-line text-muted"
          }`}
        >
          {people.length}
        </span>
      </h2>

      {people.length === 0 ? (
        <p className="rounded-card border border-dashed border-input bg-card p-4 text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {people.map((person) => (
            <li key={person.id} className="space-y-3 rounded-card border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{person.full_name || "No name"}</p>
                  <p className="truncate text-sm text-muted">{person.email}</p>
                  {person.phone && (
                    <a href={`tel:${person.phone}`} className="text-sm font-semibold text-brand">
                      {person.phone}
                    </a>
                  )}
                </div>
                {person.role && (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                      person.role === "owner" ? "bg-info-bg text-info" : "bg-success-bg text-brand"
                    }`}
                  >
                    {person.role === "owner" ? "Owner" : "Attendant"}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted">
                Signed up {formatDate(person.created_at)}
                {person.last_sign_in_at && <> · Last login {formatDateTime(person.last_sign_in_at)}</>}
              </p>

              {person.id === meId ? (
                <p className="rounded-control bg-bg p-3 text-sm text-muted">This is you.</p>
              ) : (
                <StaffActions
                  userId={person.id}
                  name={person.full_name.split(" ")[0] || "This person"}
                  role={person.role}
                  isActive={person.is_active}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
