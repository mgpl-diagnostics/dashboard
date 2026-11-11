// B2B receivables (finance-kit): customer kinds and ageing buckets, for labels.
import type { Gql } from "@mgpl-diagnostics/client";

export const CUSTOMER_KINDS: { value: Gql.CustomerKind; label: string }[] = [
  { value: "hospital", label: "Hospital" },
  { value: "insurer", label: "Insurer" },
  { value: "tpa", label: "TPA" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
];
export const customerKind = (k: Gql.CustomerKind) => CUSTOMER_KINDS.find((x) => x.value === k)?.label ?? k;

export const AGEING: { key: keyof Gql.Ageing; label: string }[] = [
  { key: "notDue", label: "Not due" },
  { key: "d1to30", label: "1 to 30 days" },
  { key: "d31to60", label: "31 to 60" },
  { key: "d61to90", label: "61 to 90" },
  { key: "d90plus", label: "Over 90" },
];
