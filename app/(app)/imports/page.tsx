"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, FileButton, Group, SegmentedControl, Tabs, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { FileArrowUpIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { fileToBase64, type Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { ImportDrawer } from "@/components/imports/ImportDrawer";
import { SignatoryRegistry } from "@/components/imports/SignatoryRegistry";
import { dateTime } from "@/lib/format";
import { importErrorMessage } from "@/lib/imports";
import { mgpl } from "@/lib/mgpl";
import { useImports } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

type Status = Gql.ExternalReportStatus | "";

export default function ImportsPage() {
  return (
    <Guard permission="report:import">
      <Suspense>
        <Imports />
      </Suspense>
    </Guard>
  );
}

function Imports() {
  const { can } = useViewer();
  const params = useSearchParams();
  const [tab, setTab] = useState<string | null>("imports");
  const [open, setOpen] = useState<string | null>(params.get("import"));

  return (
    <Enter>
      <PageHeader
        title="Partner imports"
        description="Reports from Hy Patho Lab and Clinova Pathlabs, read from their PDF and applied to our bookings"
        actions={<UploadButton onUploaded={(r) => { setTab("imports"); setOpen(r.id); }} />}
      />
      {can("signatory:read") ? (
        <Tabs value={tab} onChange={setTab} data-enter keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="imports">Imports</Tabs.Tab>
            <Tabs.Tab value="signatories">Partner signatories</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="imports"><ImportList onOpen={setOpen} /></Tabs.Panel>
          <Tabs.Panel value="signatories"><SignatoryRegistry /></Tabs.Panel>
        </Tabs>
      ) : (
        <div data-enter><ImportList onOpen={setOpen} /></div>
      )}
      <ImportDrawer id={open} onClose={() => setOpen(null)} />
    </Enter>
  );
}

/** Picks a PDF and uploads it. The same PDF again returns the import it already made. */
function UploadButton({ onUploaded }: { onUploaded: (r: Gql.ExternalReport) => void }) {
  const { workBranchId } = useViewer();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function upload(file: File | null) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      notifications.show({ color: "red", title: "Not a PDF", message: "Choose the partner lab's PDF report" });
      return;
    }
    setBusy(true);
    try {
      const r = await mgpl.imports.upload(await fileToBase64(file), { fileName: file.name, ...(workBranchId ? { branchId: workBranchId } : {}) });
      await qc.invalidateQueries({ queryKey: ["mgpl", "imports"] });
      notifications.show({ color: "tulsi", message: `Read ${r.tests.length} ${r.tests.length === 1 ? "test" : "tests"} from ${r.labName}` });
      onUploaded(r);
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't read the PDF", message: importErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FileButton onChange={upload} accept="application/pdf">
      {(props) => (
        <Button {...props} loading={busy} leftSection={<FileArrowUpIcon size={18} />}>
          Upload partner PDF
        </Button>
      )}
    </FileButton>
  );
}

function ImportList({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<Status>("extracted");
  const [search, setSearch] = useState("");
  const q = useImports(status ? { status } : {});
  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.nodes), [q.data]);
  const table = useTable(rows, { sortBy: "uploadedAt", direction: "desc", search, searchKeys: ["patient.name", "booking.bookingNo", "fileName", "labName", "sampleIds"] });

  return (
    <>
      <Group justify="space-between" gap="sm" mb="md">
        <SegmentedControl
          value={status}
          onChange={(v) => setStatus(v as Status)}
          data={[
            { value: "extracted", label: "To match" },
            { value: "matched", label: "To apply" },
            { value: "applied", label: "Applied" },
            { value: "rejected", label: "Rejected" },
            { value: "", label: "All" },
          ]}
          style={{ overflowX: "auto", maxWidth: "100%" }}
        />
        <TextInput placeholder="Patient, booking or file" aria-label="Filter" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 260 }} />
      </Group>
      {q.isError ? (
        <QueryError error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <DataTable
            {...tableLook}
            {...table}
            fetching={q.isPending}
            noRecordsText={status === "extracted" ? "Nothing waiting. Upload a partner PDF to start" : "No imports here"}
            onRowClick={({ record }) => onOpen(record.id)}
            columns={[
              { accessor: "patient.name", title: "Patient (as printed)", sortable: true, render: (r) => <Text size="sm" fw={500}>{r.patient.name ?? "Not read"}</Text> },
              { accessor: "labName", title: "Partner", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
              { accessor: "tests", title: "Tests", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (r) => <Text size="sm" lineClamp={1} maw={280}>{r.tests.map((t) => t.name).join(", ")}</Text> },
              { accessor: "booking.bookingNo", title: "Booking", render: (r) => (r.booking ? <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{r.booking.bookingNo}</Text> : <Text size="sm" c="dimmed">Not matched</Text>) },
              { accessor: "status", title: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { accessor: "uploadedAt", title: "Uploaded", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (r) => dateTime(r.uploadedAt) },
            ]}
          />
          {q.hasNextPage && (
            <Group justify="center" mt="sm">
              <Button variant="subtle" size="xs" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load older imports</Button>
            </Group>
          )}
        </>
      )}
      {rows.some((r) => r.warnings.length > 0) && status === "extracted" && (
        <Alert color="saffron" mt="md" variant="light">Some imports have reader warnings. Open them and check the values against the PDF before applying.</Alert>
      )}
    </>
  );
}
