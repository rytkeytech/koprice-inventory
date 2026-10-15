"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  checkEmail,
  checkFullName,
  checkPassword,
  checkPhone,
  normalisePhone,
} from "@/lib/validation";

export type FormState = {
  error?: string;
  message?: string;
  /** Values to put back in the form after an error. */
  values?: Record<string, string>;
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Turn Supabase error codes into plain English.
function friendlyAuthError(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with letters and numbers.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "same_password":
      return "Choose a password different from your old one.";
    default:
      return fallback;
  }
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const values = { email };

  const invalid = checkEmail(email) ?? (password ? null : "Enter your password.");
  if (invalid) return { error: invalid, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: friendlyAuthError(error.code, "Could not log in. Please try again."), values };
  }

  redirect("/");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = field(formData, "full_name").trim();
  const phone = normalisePhone(field(formData, "phone"));
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const values = { full_name: fullName, phone, email };

  const invalid =
    checkFullName(fullName) ?? checkPhone(phone) ?? checkEmail(email) ?? checkPassword(password);
  if (invalid) return { error: invalid, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });
  if (error) {
    return { error: friendlyAuthError(error.code, "Could not create the account. Please try again."), values };
  }

  // If email confirmation is off in Supabase, the user is logged in already.
  if (data.session) redirect("/");

  return {
    message: "Account created. Check your email and tap the link to confirm, then log in.",
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email").trim();
  const invalid = checkEmail(email);
  if (invalid) return { error: invalid, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: friendlyAuthError(error.code, ""), values: { email } };
  }

  // Same message whether or not the account exists, so emails can't be guessed.
  return {
    message: "If an account exists for that email, we've sent a link to reset the password. Check your inbox.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = field(formData, "password");
  const confirm = field(formData, "confirm_password");

  const invalid = checkPassword(password) ?? (password === confirm ? null : "The two passwords don't match.");
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: friendlyAuthError(error.code, "Could not change the password. Please try again.") };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
