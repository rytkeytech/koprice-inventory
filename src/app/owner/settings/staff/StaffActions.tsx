"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/ui/form";
import { updateStaffAccess, type StaffActionState, type StaffIntent } from "./actions";

type Props = {
  userId: string;
  name: string;
  role: "owner" | "attendant" | null;
  isActive: boolean;
};

type ActionButton = {
  intent: StaffIntent;
  label: string;
  style: "primary" | "secondary" | "danger";
  /** Ask "are you sure?" first, with this explanation. */
  confirm?: string;
};

function buttonsFor({ name, role, isActive }: Props): ActionButton[] {
  if (!role) {
    return [
      { intent: "approve_attendant", label: "Approve as attendant", style: "primary" },
      {
        intent: "approve_owner",
        label: "Approve as owner",
        style: "secondary",
        confirm: `${name} will see costs, profit and everything else, and can change staff access.`,
      },
    ];
  }
  if (!isActive) {
    return [{ intent: "turn_on", label: "Turn access back on", style: "primary" }];
  }
  return [
    role === "owner"
      ? { intent: "make_attendant", label: "Change to attendant", style: "secondary" }
      : {
          intent: "make_owner",
          label: "Change to owner",
          style: "secondary",
          confirm: `${name} will see costs, profit and everything else, and can change staff access.`,
        },
    {
      intent: "turn_off",
      label: "Turn off access",
      style: "danger",
      confirm: `${name} will be logged out of the app and can't use it until you turn access back on. Their sales history is kept.`,
    },
  ];
}

const styles = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-input bg-card text-ink hover:bg-bg",
  danger: "border border-danger/40 bg-card text-danger hover:bg-danger/10",
};

export function StaffActions(props: Props) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(updateStaffAccess, {});
  const [confirming, setConfirming] = useState<ActionButton | null>(null);
  const buttons = buttonsFor(props);

  return (
    <form
      action={(formData) => {
        setConfirming(null);
        action(formData);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="user_id" value={props.userId} />
      <input type="hidden" name="current_role" value={props.role ?? ""} />

      {confirming ? (
        <div className="space-y-3 rounded-control bg-warning-bg p-3">
          <p className="text-warning">{confirming.confirm}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              name="intent"
              value={confirming.intent}
              className={`h-12 rounded-control font-semibold ${styles[confirming.style === "danger" ? "danger" : "primary"]}`}
            >
              Yes, {confirming.label.toLowerCase()}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={`h-12 rounded-control font-semibold ${styles.secondary}`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) =>
            b.confirm ? (
              <button
                key={b.intent}
                type="button"
                disabled={pending}
                onClick={() => setConfirming(b)}
                className={`h-12 flex-1 rounded-control px-4 font-semibold whitespace-nowrap disabled:opacity-60 ${styles[b.style]}`}
              >
                {b.label}
              </button>
            ) : (
              <button
                key={b.intent}
                type="submit"
                name="intent"
                value={b.intent}
                disabled={pending}
                className={`h-12 flex-1 rounded-control px-4 font-semibold whitespace-nowrap disabled:opacity-60 ${styles[b.style]}`}
              >
                {b.label}
              </button>
            ),
          )}
        </div>
      )}

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Saving…
        </p>
      )}
      {!pending && <FormAlert error={state.error} message={state.done} />}
    </form>
  );
}
