import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const IST = "Asia/Kolkata";

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Integer paise → "Rs 1,234.00". Money never leaves paise anywhere else. */
export const rupees = (paise: number | null | undefined) => (paise == null ? "–" : `Rs ${inr.format(paise / 100)}`);
/** Whole rupees for figures and charts. */
export const rupeesShort = (paise: number) => `Rs ${inr0.format(Math.round(paise / 100))}`;
/** Rupees typed by a person → integer paise. */
export const toPaise = (rupeesValue: number) => Math.round(rupeesValue * 100);

export const dateTime = (iso: string | null | undefined) => (iso ? dayjs(iso).tz(IST).format("D MMM YYYY, h:mm A") : "–");
export const date = (iso: string | null | undefined) => (iso ? dayjs(iso).tz(IST).format("D MMM YYYY") : "–");
export const time = (iso: string | null | undefined) => (iso ? dayjs(iso).tz(IST).format("h:mm A") : "–");
export const ago = (iso: string | null | undefined) => (iso ? dayjs(iso).fromNow() : "–");

/** Today in IST as an ISO range, for "today" queries. */
export function todayRange() {
  const start = dayjs().tz(IST).startOf("day");
  return { from: start.toISOString(), to: start.endOf("day").toISOString() };
}

/** The current Indian financial year (April–March), as a range up to now. */
export function financialYearRange() {
  const now = dayjs().tz(IST);
  const startYear = now.month() >= 3 ? now.year() : now.year() - 1;
  return { from: dayjs.tz(`${startYear}-04-01`, IST).toISOString(), to: now.toISOString(), label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}` };
}

export const isToday = (iso: string) => dayjs(iso).tz(IST).isSame(dayjs().tz(IST), "day");

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export { dayjs };
