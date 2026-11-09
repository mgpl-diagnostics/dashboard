"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Group, SegmentedControl, Text, TextInput } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { BookingDrawer } from "@/components/booking/BookingDrawer";
import { NewBooking } from "@/components/booking/NewBooking";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { TubeCap } from "@/components/TubeCap";
import { dateTime, rupees } from "@/lib/format";
import { useBookings } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

const STATUSES = [
  { value: "", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "sample_collected", label: "Collected" },
  { value: "in_process", label: "In process" },
  { value: "completed", label: "Completed" },
];

export default function BookingsPage() {
  return (
    <Guard permission="booking:read">
      <Suspense>
        <Bookings />
      </Suspense>
    </Guard>
  );
}

function Bookings() {
  const { can } = useViewer();
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const q = useBookings(status ? { status: status as Gql.BookingStatus } : {});
  const table = useTable(q.data, { sortBy: "createdAt", search, searchKeys: ["bookingNo", "patient.name", "patient.uhid"] });
  const creating = params.get("new") === "1";

  return (
    <Enter>
      <PageHeader
        title="Bookings"
        description="Latest 200 for the branch you picked"
        actions={can("booking:create") && <Button leftSection={<PlusIcon size={16} />} onClick={() => router.replace("/bookings?new=1")}>New booking</Button>}
      />
      <Group data-enter justify="space-between" gap="sm">
        <SegmentedControl data={STATUSES} value={status} onChange={setStatus} size="sm" style={{ overflowX: "auto", maxWidth: "100%" }} />
        <TextInput placeholder="Booking no, patient or UHID" aria-label="Filter bookings" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 280 }} />
      </Group>
      <div data-enter>
        {q.isError ? (
          <QueryError error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable<Gql.Booking>
            {...tableLook}
            {...table}
            fetching={q.isPending}
            onRowClick={({ record }) => setOpenId(record.id)}
            columns={[
              { accessor: "bookingNo", title: "Booking", sortable: true, render: (b) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.bookingNo}</Text> },
              { accessor: "patient.name", title: "Patient", sortable: true, render: (b) => <><Text size="sm" fw={500}>{b.patient.name}</Text><Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.patient.uhid}</Text></> },
              {
                accessor: "tests", title: "Tests", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`,
                render: (b) => (
                  <Group gap={6} wrap="nowrap">
                    {[...new Set(b.tests.map((t) => t.sampleType))].map((s) => <TubeCap key={s ?? "none"} sampleType={s} withLabel={false} />)}
                    <Text size="sm" lineClamp={1} maw={320}>{b.tests.map((t) => t.name).join(", ")}</Text>
                  </Group>
                ),
              },
              { accessor: "status", title: "Status", sortable: true, render: (b) => <StatusBadge status={b.status} /> },
              { accessor: "invoice.duePaise", title: "Due", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (b) => <Text size="sm" className="figure" c={b.invoice && b.invoice.duePaise > 0 ? "red" : "dimmed"}>{b.invoice ? rupees(b.invoice.duePaise) : "Not billed"}</Text> },
              { accessor: "createdAt", title: "Booked", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (b) => dateTime(b.createdAt) },
            ]}
          />
        )}
      </div>
      <BookingDrawer id={openId} onClose={() => setOpenId(null)} />
      <NewBooking opened={creating} onClose={() => router.replace("/bookings")} onDone={(b) => setOpenId(b.id)} />
    </Enter>
  );
}
