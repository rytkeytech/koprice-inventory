import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Forgot password</h1>
      <p className="mt-1 mb-5 text-muted">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
