import { Badge } from "@mantine/core";
import { humanize } from "@/lib/format";

// Semantic colour carries meaning only: green = done or fine, red = a problem, saffron = needs you.
const COLOR: Record<string, string> = {
  booked: "gray", sample_collected: "navy", in_process: "saffron", completed: "tulsi", cancelled: "red",
  pending: "gray", collected: "navy", received: "tulsi", rejected: "red",
  draft: "gray", entered: "saffron", verified: "navy", released: "tulsi", amended: "yellow",
  issued: "saffron", partially_paid: "yellow", paid: "tulsi", refunded: "gray", credited: "gray",
  active: "tulsi", disabled: "red", invited: "yellow",
  posted: "tulsi",
  extracted: "saffron", matched: "navy", applied: "tulsi",
  accrued: "saffron",
  unmatched: "saffron", ignored: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={COLOR[status] ?? "gray"}>{humanize(status)}</Badge>;
}
