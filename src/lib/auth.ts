import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "attendant";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role | null;
  isActive: boolean;
};

/**
 * The logged-in user and their profile, or null if not logged in.
 * Wrapped in cache() so layouts and pages in one request share one lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
    role: (profile?.role as Role | null) ?? null,
    isActive: profile?.is_active ?? false,
  };
});

/** Where a user should land after login, based on their role. */
export function homePathFor(user: CurrentUser | null) {
  if (!user) return "/login";
  if (!user.role || !user.isActive) return "/pending";
  return user.role === "owner" ? "/owner" : "/sell";
}

/**
 * Role guard for pages and layouts. Redirects anyone who shouldn't be here.
 * "staff" = any approved, active user (owner can use attendant screens too).
 * The database (RLS) is still the real protection; this keeps the UI tidy.
 */
export async function requireRole(required: "staff" | "owner") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.role || !user.isActive) redirect("/pending");
  if (required === "owner" && user.role !== "owner") redirect("/sell");
  return user;
}
