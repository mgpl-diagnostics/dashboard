"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Group, SegmentedControl, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { BarcodeIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { TubeCap } from "@/components/TubeCap";
import { BookingDrawer } from "@/components/booking/BookingDrawer";
import { dateTime, humanize } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction, useBookings } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

interface Row extends Gql.Sample { booking: Gql.Booking }

export default function SamplesPage() {
  return (
    <Guard permission="sample:read">
      <Suspense>
        <Samples />
      </Suspense>
    </Guard>
  );
}

function Samples() {
  const { can } = useViewer();
  const params = useSearchParams();
  const bookingFilter = params.get("booking");
  // Each role lands on its own queue: phlebotomists collect, technicians receive.
  const [status, setStatus] = useState<string>(params.get("q") || bookingFilter ? "" : can("sample:collect") && !can("sample:receive") ? "pending" : can("sample:receive") ? "collected" : "");
  const [scan, setScan] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Row[]>([]);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const q = useBookings();

  const rows = useMemo<Row[]>(
    () => (q.data ?? []).filter((b) => b.status !== "cancelled" && (!bookingFilter || b.id === bookingFilter)).flatMap((b) => b.samples.map((s) => ({ ...s, booking: b }))),
    [q.data, bookingFilter],
  );
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  const table = useTable(filtered, { sortBy: "barcode", direction: "asc", search: scan, searchKeys: ["barcode", "booking.patient.name", "booking.bookingNo", "sampleType"] });
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  const refresh = [["mgpl", "bookings"]];
  const collect = useAction((ids: string[]) => Promise.all(ids.map((id) => mgpl.samples.collect(id))), { success: (r) => `${r.length} collected`, refresh, onDone: () => setSelected([]) });
  const receive = useAction((ids: string[]) => Promise.all(ids.map((id) => mgpl.samples.receive(id))), { success: (r) => `${r.length} received at the lab`, refresh, onDone: () => setSelected([]) });
  const reject = useAction((v: { id: string; reason: string }) => mgpl.samples.reject(v.id, v.reason), { success: "Sample rejected. Ask for a fresh one", refresh });

  // A barcode scanner types the code and presses Enter.
  async function onScan() {
    const code = scan.trim();
    if (!code) return;
    try {
      const s = await mgpl.samples.byBarcode(code);
      if (!s) notifications.show({ color: "yellow", message: `No sample has barcode ${code}` });
      else setStatus("");
    } catch (err) {
      notifications.show({ color: "red", message: errorMessage(err) });
    }
  }

  function askReject(r: Row) {
    let reason = "";
    modals.openConfirmModal({
      title: `Reject ${r.barcode}?`,
      children: (
        <TextInput label="Why" placeholder="Haemolysed, clotted, wrong tube, not enough" data-autofocus onChange={(e) => (reason = e.currentTarget.value)} />
      ),
      labels: { confirm: "Reject sample", cancel: "Keep it" },
      confirmProps: { color: "red" },
      onConfirm: () => (reason.trim() ? reject.mutate({ id: r.id, reason: reason.trim() }) : notifications.show({ color: "red", message: "Say why the sample is rejected" })),
    });
  }

  const canCollect = can("sample:collect");
  const canReceive = can("sample:receive");
  const selectable = canCollect || canReceive;

  return (
    <Enter>
      <PageHeader title="Samples" description="Scan a barcode, or work through the queue" />
      <Group data-enter justify="space-between" gap="sm" align="flex-end">
        <SegmentedControl
          value={status}
          onChange={(v) => { setStatus(v); setSelected([]); }}
          data={[
            { value: "pending", label: `To collect ${count("pending")}` },
            { value: "collected", label: `To receive ${count("collected")}` },
            { value: "received", label: `Received ${count("received")}` },
            { value: "rejected", label: `Rejected ${count("rejected")}` },
            { value: "", label: "All" },
          ]}
          style={{ overflowX: "auto", maxWidth: "100%" }}
        />
        <TextInput
          w={{ base: "100%", sm: 300 }}
          placeholder="Scan or type a barcode"
          aria-label="Barcode"
          leftSection={<BarcodeIcon size={18} />}
          value={scan}
          onChange={(e) => setScan(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && onScan()}
        />
      </Group>

      {selected.length > 0 && (
        <Group data-enter gap="xs" p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 12 }}>
          <Text size="sm" mr="auto">{selected.length} selected</Text>
          {canCollect && <Button size="xs" leftSection={<CheckIcon size={14} />} loading={collect.isPending} disabled={!selected.every((r) => r.status === "pending")} onClick={() => collect.mutate(selected.map((r) => r.id))}>Mark collected</Button>}
          {canReceive && <Button size="xs" variant="light" loading={receive.isPending} disabled={!selected.every((r) => r.status === "collected")} onClick={() => receive.mutate(selected.map((r) => r.id))}>Mark received</Button>}
        </Group>
      )}

      <div data-enter>
        {q.isError ? (
          <QueryError error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable<Row>
            {...tableLook}
            {...table}
            fetching={q.isPending}
            noRecordsText={status === "pending" ? "Every sample is collected" : status === "collected" ? "Nothing waiting at the lab" : "No samples"}
            {...(selectable ? { selectedRecords: selected, onSelectedRecordsChange: setSelected, isRecordSelectable: (r: Row) => r.status === "pending" || r.status === "collected" } : {})}
            columns={[
              { accessor: "barcode", title: "Barcode", sortable: true, render: (r) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{r.barcode}</Text> },
              { accessor: "sampleType", title: "Sample", sortable: true, render: (r) => <TubeCap sampleType={r.sampleType} /> },
              { accessor: "booking.patient.name", title: "Patient", sortable: true, render: (r) => <><Text size="sm" fw={500}>{r.booking.patient.name}</Text><Text size="xs" c="dimmed">{humanize(r.booking.sampleCollection.type)}</Text></> },
              { accessor: "status", title: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
              { accessor: "collectedAt", title: "Collected", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (r) => (r.rejectReason ? <Text size="sm" c="red">{r.rejectReason}</Text> : dateTime(r.collectedAt)) },
              {
                accessor: "actions", title: "", textAlign: "right",
                render: (r) => (
                  <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                    {canCollect && r.status === "pending" && <Button size="compact-xs" onClick={() => collect.mutate([r.id])}>Collect</Button>}
                    {canReceive && r.status === "collected" && <Button size="compact-xs" variant="light" onClick={() => receive.mutate([r.id])}>Receive</Button>}
                    {can("sample:reject") && (r.status === "collected" || r.status === "received") && (
                      <Button size="compact-xs" variant="subtle" color="red" leftSection={<XIcon size={12} />} onClick={() => askReject(r)}>Reject</Button>
                    )}
                  </Group>
                ),
              },
            ]}
            onRowClick={({ record }) => can("booking:read") && setOpenBooking(record.booking.id)}
          />
        )}
      </div>
      <BookingDrawer id={openBooking} onClose={() => setOpenBooking(null)} />
    </Enter>
  );
}
