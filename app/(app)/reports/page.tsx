"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Group, Progress, SegmentedControl, Text, TextInput } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportPanel } from "@/components/report/ReportPanel";
import { dateTime } from "@/lib/format";
import { useBookings } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

type Stage = "enter" | "verify" | "release" | "done" | "";

// A booking can sit in several queues at once: one test waiting for entry, another for verification.
const IN: Record<Exclude<Stage, "">, (b: Gql.Booking) => boolean> = {
  enter: (b) => b.reports.length < b.tests.length || b.reports.some((x) => x.status === "draft" || x.status === "amended"),
  verify: (b) => b.reports.some((x) => x.status === "entered"),
  release: (b) => b.reports.some((x) => x.status === "verified"),
  done: (b) => b.reports.length === b.tests.length && b.reports.every((x) => x.status === "released"),
};

export default function ReportsPage() {
  return (
    <Guard permission="report:read">
      <Suspense>
        <Reports />
      </Suspense>
    </Guard>
  );
}

function Reports() {
  const { can } = useViewer();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get("booking"));
  const [search, setSearch] = useState("");
  // Pathologists land on verification, technicians on entry, managers on release.
  const [stage, setStage] = useState<Stage>(can("report:verify") ? "verify" : can("report:enter") ? "enter" : can("report:release") ? "release" : "");
  const q = useBookings({}, can("booking:read"));

  const rows = useMemo(() => (q.data ?? []).filter((b) => b.status !== "cancelled" && b.status !== "booked"), [q.data]);
  const shown = stage ? rows.filter(IN[stage]) : rows;
  const table = useTable(shown, { sortBy: "createdAt", direction: "asc", search, searchKeys: ["bookingNo", "patient.name", "patient.uhid"] });
  const n = (s: Exclude<Stage, "">) => rows.filter(IN[s]).length;

  if (!can("booking:read")) {
    return (
      <Enter>
        <PageHeader title="Reports" />
        <Alert color="gray" data-enter>Find the patient in Patients to see their released reports.</Alert>
      </Enter>
    );
  }

  return (
    <Enter>
      <PageHeader title="Reports" description="Oldest first, so nothing waits too long" />
      <Group data-enter justify="space-between" gap="sm">
        <SegmentedControl
          value={stage}
          onChange={(v) => setStage(v as Stage)}
          data={[
            { value: "enter", label: `To enter ${n("enter")}` },
            { value: "verify", label: `To verify ${n("verify")}` },
            { value: "release", label: `To release ${n("release")}` },
            { value: "done", label: "Released" },
            { value: "", label: "All" },
          ]}
          style={{ overflowX: "auto", maxWidth: "100%" }}
        />
        <TextInput placeholder="Booking no or patient" aria-label="Filter" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 260 }} />
      </Group>
      <div data-enter>
        {q.isError ? (
          <QueryError error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable
            {...tableLook}
            {...table}
            fetching={q.isPending}
            noRecordsText="Nothing in this queue"
            onRowClick={({ record }) => setOpen(record.id)}
            columns={[
              { accessor: "bookingNo", title: "Booking", sortable: true, render: (b) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.bookingNo}</Text> },
              { accessor: "patient.name", title: "Patient", sortable: true, render: (b) => <Text size="sm" fw={500}>{b.patient.name}</Text> },
              { accessor: "tests", title: "Tests", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (b) => <Text size="sm" lineClamp={1} maw={300}>{b.tests.map((t) => t.name).join(", ")}</Text> },
              {
                accessor: "progress", title: "Released", width: 160, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`,
                render: (b) => {
                  const done = b.reports.filter((r) => r.status === "released").length;
                  return (
                    <Group gap={8} wrap="nowrap">
                      <Progress value={(done / Math.max(1, b.tests.length)) * 100} w={80} size="sm" color="tulsi" aria-label={`${done} of ${b.tests.length} released`} />
                      <Text size="xs" c="dimmed" className="figure">{done}/{b.tests.length}</Text>
                    </Group>
                  );
                },
              },
              { accessor: "status", title: "Booking", render: (b) => <StatusBadge status={b.status} /> },
              { accessor: "createdAt", title: "Booked", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (b) => dateTime(b.createdAt) },
            ]}
          />
        )}
      </div>
      <ReportPanel bookingId={open} onClose={() => setOpen(null)} />
    </Enter>
  );
}
