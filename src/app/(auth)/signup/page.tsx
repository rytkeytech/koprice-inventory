import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Create account</h1>
      <p className="mt-1 mb-5 text-muted">
        After you sign up, the owner must approve your account before you can use the app.
      </p>
      <SignupForm />
    </>
  );
}
