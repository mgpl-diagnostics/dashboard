import type { Gql } from "@mgpl-diagnostics/client";

/** Payment modes the api accepts, in the order the counter uses them. */
export const PAYMENT_MODES: Gql.PaymentMode[] = ["cash", "upi", "card", "netbanking", "wallet", "cheque", "insurance"];

const LABEL: Partial<Record<Gql.PaymentMode, string>> = { upi: "UPI", netbanking: "Bank transfer" };
export const modeLabel = (m: Gql.PaymentMode) => LABEL[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
export const PAYMENT_MODE_OPTIONS = PAYMENT_MODES.map((m) => ({ value: m, label: modeLabel(m) }));
