"use client";

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
};

/** Labelled text input sized for phones (48px tall, 16px text so iOS won't zoom). */
export function Field({ label, name, hint, id, className, ...input }: FieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-describedby={hintId}
        className={`h-12 w-full rounded-control border border-input bg-card px-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 ${className ?? ""}`}
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "accent";
};

/** Submit button that shows a spinner and blocks double taps while saving. */
export function SubmitButton({ children, pendingText, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const colours =
    variant === "accent"
      ? "bg-accent text-ink hover:brightness-95"
      : "bg-brand text-white hover:bg-brand-dark";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-control text-lg font-bold transition disabled:opacity-70 ${colours}`}
    >
      {pending && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}

/** Error or success message under a form. Announced to screen readers. */
export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-control bg-danger/10 p-3 text-danger">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }
  if (message) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-control bg-success-bg p-3 text-brand">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>{message}</p>
      </div>
    );
  }
  return null;
}
