"use client";

import { ReasonActions } from "@/components/ReasonAction";
import { decideRequest, requestApproval, reverseSale } from "@/lib/actions/approvals";

/** Owner: approve or reject a request. */
export function RequestDecision({ requestId, approveExplain }: { requestId: string; approveExplain: string }) {
  return (
    <ReasonActions
      reasonLabel="Note"
      actions={[
        {
          label: "Approve",
          confirmLabel: "Yes, approve",
          tone: "primary",
          explain: approveExplain,
          run: (reason) => decideRequest(requestId, true, reason),
        },
        {
          label: "Reject",
          confirmLabel: "Yes, reject",
          tone: "danger",
          explain: "Nothing will change. The attendant will see that you said no.",
          reasonRequired: true,
          run: (reason) => decideRequest(requestId, false, reason),
        },
      ]}
    />
  );
}

/** Owner: refund or cancel a completed sale directly. */
export function OwnerSaleActions({ saleId }: { saleId: string }) {
  return (
    <ReasonActions
      actions={[
        {
          label: "Refund",
          confirmLabel: "Yes, refund",
          tone: "secondary",
          explain: "The goods came back: stock is returned and any credit is taken off the customer's balance.",
          reasonRequired: true,
          run: (reason) => reverseSale(saleId, "refund", reason),
        },
        {
          label: "Cancel sale",
          confirmLabel: "Yes, cancel it",
          tone: "danger",
          explain: "The sale was a mistake: it is cancelled, stock is returned and credit is reversed. The record is kept.",
          reasonRequired: true,
          run: (reason) => reverseSale(saleId, "void", reason),
        },
      ]}
    />
  );
}

/** Attendant: ask the owner to refund or cancel their own sale. */
export function AttendantSaleRequest({ saleId }: { saleId: string }) {
  return (
    <ReasonActions
      actions={[
        {
          label: "Ask for refund",
          confirmLabel: "Send request",
          tone: "secondary",
          explain: "Use this when the customer brought goods back. The owner decides.",
          reasonRequired: true,
          run: (reason) => requestApproval("refund", { sale_id: saleId, reason }),
        },
        {
          label: "Ask to cancel sale",
          confirmLabel: "Send request",
          tone: "danger",
          explain: "Use this when the sale was entered by mistake. The owner decides.",
          reasonRequired: true,
          run: (reason) => requestApproval("void_sale", { sale_id: saleId, reason }),
        },
      ]}
    />
  );
}
