import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "New password" };

// Reached from the reset email link (which logs the user in first),
// or by any logged-in user who wants to change their password.
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Choose a new password</h1>
      <p className="mt-1 mb-5 text-muted">You&apos;ll use this to log in from now on.</p>
      <ResetPasswordForm />
    </>
  );
}
