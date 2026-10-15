"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StaffActionState = { error?: string; done?: string };

type Role = "owner" | "attendant";

// What each button does: the role and active flag it sets.
// role "keep" = leave the person's current role as it is.
const INTENTS = {
  approve_attendant: { role: "attendant", active: true, done: "Approved as attendant." },
  approve_owner: { role: "owner", active: true, done: "Approved as owner." },
  make_attendant: { role: "attendant", active: true, done: "Changed to attendant." },
  make_owner: { role: "owner", active: true, done: "Changed to owner." },
  turn_off: { role: "keep", active: false, done: "Access turned off." },
  turn_on: { role: "keep", active: true, done: "Access turned back on." },
} as const;

export type StaffIntent = keyof typeof INTENTS;

// The database function checks the caller is the owner; this is just the form handler.
export async function updateStaffAccess(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const userId = formData.get("user_id");
  const intent = formData.get("intent");
  const currentRole = formData.get("current_role");

  if (typeof userId !== "string" || typeof intent !== "string" || !(intent in INTENTS)) {
    return { error: "Something went wrong. Please reload the page and try again." };
  }

  const current: Role | null =
    currentRole === "owner" || currentRole === "attendant" ? currentRole : null;
  const chosen = INTENTS[intent as StaffIntent];
  const role: Role = chosen.role === "keep" ? (current ?? "attendant") : chosen.role;
  const { active, done } = chosen;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_access", {
    p_user_id: userId,
    p_role: role,
    p_is_active: active,
  });

  if (error) {
    if (error.message.includes("own owner access")) {
      return { error: "You can't remove your own owner access." };
    }
    if (error.message.includes("Only the owner")) {
      return { error: "Only the owner can do this." };
    }
    return { error: "Could not save the change. Please try again." };
  }

  refresh();
  return { done };
}
