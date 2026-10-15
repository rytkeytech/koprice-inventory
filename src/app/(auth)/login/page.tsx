import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Log in</h1>
      <p className="mt-1 mb-5 text-muted">Use the email and password for your account.</p>
      {/* LoginForm reads ?error= from the URL, which needs a Suspense boundary. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
