// Collection-centre and franchise settlements (finance-kit): labels and conversions. Amounts stay in paise,
// rates in basis points (1% = 100 bp) until they are printed.
import type { Gql } from "@mgpl-diagnostics/client";
import { dayjs, IST } from "./format";

/** "2026-03" → "March 2026". */
export const monthLabel = (period: string) => dayjs.tz(`${period}-01`, IST).format("MMMM YYYY");

/** The month before this one ("YYYY-MM"): a month can be accrued only after it ends. */
export const lastMonth = () => dayjs().tz(IST).subtract(1, "month").format("YYYY-MM");

/** Basis points → "12.5%". */
export const percent = (bp: number | null | undefined) => (bp == null ? "–" : `${(bp / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`);
/** A percentage typed by a person → basis points. */
export const toBp = (pct: number) => Math.round(pct * 100);

export const PARTNER_KINDS: { value: Gql.PartnerKind; label: string }[] = [
  { value: "collection_centre", label: "Collection centre" },
  { value: "franchise", label: "Franchise" },
];

export const AGREEMENT_KINDS: { value: Gql.AgreementKind; label: string }[] = [
  { value: "revenue_share", label: "Share of revenue (%)" },
  { value: "fixed_rate", label: "Fixed amount per test" },
];

export const ITEM_CATEGORIES: { value: Gql.ItemCategory; label: string }[] = [
  { value: "test", label: "Tests" },
  { value: "package", label: "Packages" },
  { value: "service", label: "Services" },
  { value: "consumable", label: "Consumables" },
  { value: "medicine", label: "Medicines" },
  { value: "other", label: "Other" },
];
