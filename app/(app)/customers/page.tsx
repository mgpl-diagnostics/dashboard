"use client";
import { useState } from "react";
import { Button, Card, Group, SimpleGrid, Skeleton, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Figure } from "@/components/Figure";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { CreditNoteDrawer } from "@/components/receivables/CreditNoteDrawer";
import { CustomerDrawer } from "@/components/receivables/CustomerDrawer";
import { date, dayjs, IST, rupees, rupeesShort } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useCustomers } from "@/lib/queries";
import { AGEING, customerKind } from "@/lib/receivables";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function CustomersPage() {
  return (
    <Guard permission="accounts:read">
      <Customers />
    </Guard>
  );
}

function Customers() {
  const { can } = useViewer();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  return (
    <Enter>
      <PageHeader
        title="B2B customers"
        description="Hospitals, insurers, TPAs and corporates billed on credit"
        actions={can("accounts:manage") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setOpen("new")}>Add customer</Button>}
      />
      <Tabs defaultValue="customers" keepMounted={false} data-enter>
        <Tabs.List mb="md">
          <Tabs.Tab value="customers">Customers</Tabs.Tab>
          <Tabs.Tab value="ageing">Ageing</Tabs.Tab>
          <Tabs.Tab value="notes">Credit notes</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="customers"><CustomerList onOpen={setOpen} /></Tabs.Panel>
        <Tabs.Panel value="ageing"><Ageing onOpen={setOpen} /></Tabs.Panel>
        <Tabs.Panel value="notes"><CreditNotes onOpen={setNote} /></Tabs.Panel>
      </Tabs>
      {open && <CustomerDrawer id={open === "new" ? null : open} onClose={() => setOpen(null)} onCreated={(c) => setOpen(c.id)} />}
      <CreditNoteDrawer id={note} onClose={() => setNote(null)} />
    </Enter>
  );
}

function CustomerList({ onOpen }: { onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const q = useCustomers(!all);
  const table = useTable(q.data, { sortBy: "name", direction: "asc", search, searchKeys: ["name", "code", "gstin", "phone"] });
  return (
    <>
      <Group justify="space-between" gap="sm" mb="md">
        <TextInput placeholder="Name, code, GSTIN or phone" aria-label="Filter customers" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 300 }} />
        <Switch label="Show inactive" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
      </Group>
      {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Gql.Customer>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No B2B customers yet"
          onRowClick={({ record }) => onOpen(record.id)}
          columns={[
            { accessor: "name", title: "Name", sortable: true, render: (c) => <><Text size="sm" fw={500}>{c.name}</Text><Text size="xs" c="dimmed" ff="monospace">{c.code}</Text></> },
            { accessor: "kind", title: "Kind", render: (c) => customerKind(c.kind) },
            { accessor: "gstin", title: "GSTIN", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (c) => <Text size="sm" ff="monospace">{c.gstin ?? "–"}</Text> },
            { accessor: "creditLimitPaise", title: "Credit limit", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (c) => <Text size="sm" className="figure">{c.creditLimitPaise == null ? "No limit" : rupees(c.creditLimitPaise)}</Text> },
            { accessor: "creditDays", title: "Days", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (c) => <Text size="sm" className="figure">{c.creditDays}</Text> },
            { accessor: "active", title: "", textAlign: "right", render: (c) => <StatusBadge status={c.active ? "active" : "disabled"} /> },
          ]}
        />
      )}
    </>
  );
}

function Ageing({ onOpen }: { onOpen: (id: string) => void }) {
  const asOf = dayjs().tz(IST).endOf("day").toISOString();
  const q = useQuery({ queryKey: ["mgpl", "customers", "summary", asOf.slice(0, 10)], queryFn: () => mgpl.receivables.summary(asOf) });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const s = q.data;
  const totals = AGEING.map((b) => ({ bucket: b.label, Due: (s?.rows.reduce((t, r) => t + r.ageing[b.key], 0) ?? 0) / 100 }));
  const overdue = s?.rows.reduce((t, r) => t + r.overduePaise, 0) ?? 0;
  return (
    <SimpleGrid cols={1} spacing="md">
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card>
          <Text size="sm" c="dimmed">Owed by customers</Text>
          {q.isPending ? <Skeleton h={30} mt={12} /> : <Figure mt={12} value={s?.totalPaise ?? 0} format={rupeesShort} />}
          <Text size="xs" c="dimmed" mt={8}>{q.isPending ? "" : `${rupees(overdue)} overdue`}</Text>
        </Card>
        <Card style={{ gridColumn: "span 2" }} visibleFrom="md">
          <Text size="sm" c="dimmed" mb="sm">By age, as of {date(asOf)}</Text>
          {q.isPending ? <Skeleton h={120} /> : <BarChart h={120} data={totals} dataKey="bucket" series={[{ name: "Due", color: "saffron.6" }]} gridAxis="none" tickLine="none" withYAxis={false} valueFormatter={(v) => `Rs ${Math.round(v).toLocaleString("en-IN")}`} />}
        </Card>
      </SimpleGrid>
      <DataTable
        {...tableLook}
        records={s?.rows ?? []}
        idAccessor="customer.id"
        fetching={q.isPending}
        noRecordsText="Nothing owed"
        onRowClick={({ record }) => onOpen(record.customer.id)}
        columns={[
          { accessor: "customer.name", title: "Customer", render: (r) => <><Text size="sm" fw={500}>{r.customer.name}</Text><Text size="xs" c="dimmed" ff="monospace">{r.customer.code}</Text></> },
          ...AGEING.map((b) => ({
            accessor: `ageing.${b.key}`, title: b.label, textAlign: "right" as const,
            visibleMediaQuery: (t: { breakpoints: Record<string, string> }) => `(min-width: ${b.key === "notDue" || b.key === "d90plus" ? t.breakpoints.sm : t.breakpoints.lg})`,
            render: (r: Gql.ReceivablesSummary["rows"][number]) => <Text size="sm" className="figure" c={b.key === "d90plus" && r.ageing[b.key] > 0 ? "red" : undefined}>{r.ageing[b.key] ? rupees(r.ageing[b.key]) : "–"}</Text>,
          })),
          { accessor: "balancePaise", title: "Balance", textAlign: "right", render: (r) => <Text size="sm" className="figure" fw={500}>{rupees(r.balancePaise)}</Text> },
        ]}
      />
    </SimpleGrid>
  );
}

function CreditNotes({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["mgpl", "creditNotes"], queryFn: () => mgpl.receivables.creditNotes({ limit: 200 }) });
  const table = useTable(q.data, { sortBy: "date", direction: "desc", search, searchKeys: ["noteNo", "invoice.invoiceNo", "customer.name", "reason"] });
  return (
    <>
      <Group mb="md">
        <TextInput placeholder="Note, invoice or customer" aria-label="Filter credit notes" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 280 }} />
        <Text size="xs" c="dimmed">Issue a credit note from the invoice, in Invoices</Text>
      </Group>
      {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Gql.CreditNote>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No credit notes"
          onRowClick={({ record }) => onOpen(record.id)}
          columns={[
            { accessor: "noteNo", title: "Note", sortable: true, render: (n) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{n.noteNo}</Text> },
            { accessor: "date", title: "Date", sortable: true, render: (n) => date(n.date) },
            { accessor: "invoice.invoiceNo", title: "Invoice", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (n) => <Text size="sm" ff="monospace">{n.invoice.invoiceNo}</Text> },
            { accessor: "customer.name", title: "Customer", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (n) => n.customer?.name ?? "Patient" },
            { accessor: "reason", title: "Reason", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (n) => <Text size="sm" lineClamp={1} maw={260}>{n.reason}</Text> },
            { accessor: "totalPaise", title: "Amount", textAlign: "right", sortable: true, render: (n) => <Text size="sm" className="figure">{rupees(n.totalPaise)}</Text> },
          ]}
        />
      )}
    </>
  );
}
