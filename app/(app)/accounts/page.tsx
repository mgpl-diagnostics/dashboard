"use client";
import { useState } from "react";
import { Alert, Button, Card, Group, SimpleGrid, Skeleton, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { csvBlob, downloadBlob, type Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Figure } from "@/components/Figure";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { dateTime, dayjs, financialYearRange, humanize, IST, rupees, rupeesShort } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { tableLook } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function AccountsPage() {
  return (
    <Guard permission="accounts:read">
      <Accounts />
    </Guard>
  );
}

function Accounts() {
  const fy = financialYearRange();
  const [range, setRange] = useState<[string | null, string | null]>([dayjs(fy.from).tz(IST).format("YYYY-MM-DD"), dayjs().tz(IST).format("YYYY-MM-DD")]);
  const from = range[0] ? dayjs.tz(range[0], IST).startOf("day").toISOString() : fy.from;
  const to = range[1] ? dayjs.tz(range[1], IST).endOf("day").toISOString() : fy.to;
  return (
    <Enter>
      <PageHeader
        title="Accounts"
        description={`Financial year ${fy.label}, April to March`}
        actions={<DatePickerInput type="range" aria-label="Period" value={range} onChange={(v) => setRange(v as [string | null, string | null])} valueFormat="D MMM YYYY" w={260} allowSingleDateInRange />}
      />
      <Tabs defaultValue="pl" keepMounted={false} data-enter>
        <Tabs.List mb="md" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
          <Tabs.Tab value="pl">Profit and loss</Tabs.Tab>
          <Tabs.Tab value="tb">Trial balance</Tabs.Tab>
          <Tabs.Tab value="due">Receivables</Tabs.Tab>
          <Tabs.Tab value="day">Day book</Tabs.Tab>
          <Tabs.Tab value="gst">GST</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pl"><ProfitLoss from={from} to={to} /></Tabs.Panel>
        <Tabs.Panel value="tb"><Trial asOf={to} /></Tabs.Panel>
        <Tabs.Panel value="due"><Receivables /></Tabs.Panel>
        <Tabs.Panel value="day"><DayBook from={from} to={to} /></Tabs.Panel>
        <Tabs.Panel value="gst"><Gst from={from} to={to} /></Tabs.Panel>
      </Tabs>
    </Enter>
  );
}

function useExport() {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<Gql.CsvFile>) => {
      setBusy(true);
      try {
        const f = await fn();
        downloadBlob(csvBlob(f), f.fileName);
      } catch (err) {
        notifications.show({ color: "red", title: "Export failed", message: errorMessage(err) });
      } finally {
        setBusy(false);
      }
    },
  };
}

function ExportButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return <Button size="xs" variant="default" leftSection={<DownloadSimpleIcon size={14} />} loading={busy} onClick={onClick}>CSV</Button>;
}

function ProfitLoss({ from, to }: { from: string; to: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "pl", from, to, b], queryFn: () => mgpl.books.profitAndLoss({ from, to }, b) });
  const ex = useExport();
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const pl = q.data;
  const income = pl?.income.reduce((s, g) => s + g.amountPaise, 0) ?? 0;
  const expenses = pl?.expenses.reduce((s, g) => s + g.amountPaise, 0) ?? 0;
  const groups = [...(pl?.income ?? []).map((g) => ({ group: g.group.name, Income: g.amountPaise / 100, Expenses: 0 })), ...(pl?.expenses ?? []).map((g) => ({ group: g.group.name, Income: 0, Expenses: g.amountPaise / 100 }))];
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {[
          { label: "Income", v: income },
          { label: "Expenses", v: expenses },
          { label: "Net profit", v: pl?.netProfitPaise ?? 0, accent: true },
        ].map((s) => (
          <Card key={s.label}>
            <Text size="sm" c="dimmed">{s.label}</Text>
            {q.isPending ? <Skeleton h={30} mt={12} w={140} /> : <Figure mt={12} value={s.v} format={rupeesShort} c={s.accent ? (s.v < 0 ? "red" : "saffron.7") : undefined} />}
          </Card>
        ))}
      </SimpleGrid>
      <Card>
        <Group justify="space-between" mb="md">
          <Title order={2} fz={17}>By group</Title>
          <ExportButton busy={ex.busy} onClick={() => ex.run(() => mgpl.exports.profitAndLoss({ from, to }, { branchId: b }))} />
        </Group>
        {q.isPending ? <Skeleton h={300} /> : groups.length === 0 ? <Text size="sm" c="dimmed">No postings in this period</Text> : (
          <BarChart
            h={Math.max(220, groups.length * 36)}
            data={groups}
            dataKey="group"
            orientation="vertical"
            type="stacked"
            series={[{ name: "Income", color: "saffron.6" }, { name: "Expenses", color: "gray.5" }]}
            gridAxis="x"
            tickLine="none"
            yAxisProps={{ width: 160 }}
            valueFormatter={(v) => `Rs ${Math.round(v).toLocaleString("en-IN")}`}
            withLegend
          />
        )}
      </Card>
    </Stack>
  );
}

function Trial({ asOf }: { asOf: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "tb", asOf, b], queryFn: () => mgpl.books.trialBalance({ asOf, branchId: b }) });
  const ex = useExport();
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const tb = q.data;
  return (
    <Stack gap="md">
      {tb && tb.differencePaise !== 0 && <Alert color="red" title="The books don't balance">Difference of {rupees(tb.differencePaise)}. Tell the accountant before posting anything else.</Alert>}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">As of {dateTime(asOf)}</Text>
        <ExportButton busy={ex.busy} onClick={() => ex.run(() => mgpl.exports.trialBalance({ asOf, branchId: b }))} />
      </Group>
      <DataTable
        {...tableLook}
        fetching={q.isPending}
        records={(tb?.rows ?? []).map((r) => ({ ...r, id: r.ledger.id }))}
        columns={[
          { accessor: "ledger.name", title: "Ledger" },
          { accessor: "primaryGroup.name", title: "Group", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
          { accessor: "debitPaise", title: "Debit", textAlign: "right", render: (r) => <Text size="sm" className="figure">{r.debitPaise ? rupees(r.debitPaise) : ""}</Text>, footer: tb && <Text size="sm" fw={500} className="figure">{rupees(tb.totalDebitPaise)}</Text> },
          { accessor: "creditPaise", title: "Credit", textAlign: "right", render: (r) => <Text size="sm" className="figure">{r.creditPaise ? rupees(r.creditPaise) : ""}</Text>, footer: tb && <Text size="sm" fw={500} className="figure">{rupees(tb.totalCreditPaise)}</Text> },
        ]}
      />
    </Stack>
  );
}

function Receivables() {
  const { branchId } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "books", "outstanding", branchId], queryFn: () => mgpl.books.outstandingReceivables(branchId ? { branchId } : {}) });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const o = q.data;
  const buckets = o ? [
    { bucket: "0 to 30 days", Due: o.buckets.d0to30 / 100 },
    { bucket: "31 to 60", Due: o.buckets.d31to60 / 100 },
    { bucket: "61 to 90", Due: o.buckets.d61to90 / 100 },
    { bucket: "Over 90", Due: o.buckets.d90plus / 100 },
  ] : [];
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card>
          <Text size="sm" c="dimmed">Outstanding</Text>
          {q.isPending ? <Skeleton h={30} mt={12} /> : <Figure mt={12} value={o?.totalDuePaise ?? 0} format={rupeesShort} />}
          <Text size="xs" c="dimmed" mt={8}>{o?.rows.length ?? 0} open invoices</Text>
        </Card>
        <Card style={{ gridColumn: "span 2" }} visibleFrom="md">
          <Text size="sm" c="dimmed" mb="sm">By age</Text>
          {q.isPending ? <Skeleton h={120} /> : <BarChart h={120} data={buckets} dataKey="bucket" series={[{ name: "Due", color: "saffron.6" }]} gridAxis="none" tickLine="none" withYAxis={false} valueFormatter={(v) => `Rs ${Math.round(v).toLocaleString("en-IN")}`} />}
        </Card>
      </SimpleGrid>
      <DataTable
        {...tableLook}
        fetching={q.isPending}
        records={(o?.rows ?? []).map((r) => ({ ...r, id: r.invoice.id }))}
        noRecordsText="Nothing outstanding"
        columns={[
          { accessor: "invoice.invoiceNo", title: "Invoice", render: (r) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{r.invoice.invoiceNo}</Text> },
          { accessor: "invoice.patient.name", title: "Patient" },
          { accessor: "ageDays", title: "Age", textAlign: "right", render: (r) => <Text size="sm" className="figure" c={r.ageDays > 90 ? "red" : undefined}>{r.ageDays} d</Text> },
          { accessor: "invoice.duePaise", title: "Due", textAlign: "right", render: (r) => <Text size="sm" className="figure">{rupees(r.invoice.duePaise)}</Text> },
        ]}
      />
    </Stack>
  );
}

function DayBook({ from, to }: { from: string; to: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "day", from, to, b], queryFn: () => mgpl.books.dayBook({ from, to }, { branchId: b }) });
  const ex = useExport();
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <Stack gap="md">
      <Group justify="flex-end"><ExportButton busy={ex.busy} onClick={() => ex.run(() => mgpl.exports.dayBook({ from, to }, { branchId: b }))} /></Group>
      <DataTable<Gql.Voucher>
        {...tableLook}
        fetching={q.isPending}
        records={q.data ?? []}
        noRecordsText="No vouchers in this period"
        rowExpansion={{
          content: ({ record }) => (
            <Table verticalSpacing={4} px="md">
              <Table.Tbody>
                {record.entries.map((e, k) => (
                  <Table.Tr key={k}>
                    <Table.Td><Text size="sm">{e.ledger.name}</Text></Table.Td>
                    <Table.Td ta="right" className="figure">{e.debitPaise ? rupees(e.debitPaise) : ""}</Table.Td>
                    <Table.Td ta="right" className="figure">{e.creditPaise ? rupees(e.creditPaise) : ""}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ),
        }}
        columns={[
          { accessor: "date", title: "Date", render: (v) => dateTime(v.date) },
          { accessor: "voucherNo", title: "Voucher", render: (v) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{v.voucherNo}</Text> },
          { accessor: "type", title: "Type", render: (v) => humanize(v.type), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
          { accessor: "narration", title: "Narration", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (v) => <Text size="sm" lineClamp={1}>{v.narration ?? ""}</Text> },
          { accessor: "amount", title: "Amount", textAlign: "right", render: (v) => <Text size="sm" className="figure">{rupees(v.entries.reduce((s, e) => s + e.debitPaise, 0))}</Text> },
          { accessor: "status", title: "", textAlign: "right", render: (v) => <StatusBadge status={v.status} /> },
        ]}
      />
    </Stack>
  );
}

function Gst({ from, to }: { from: string; to: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "gst", from, to, b], queryFn: () => mgpl.books.gstSummary({ from, to }, b) });
  const ca = useQuery({ queryKey: ["mgpl", "gst", "verifyWithCA"], queryFn: () => mgpl.gst.verifyWithCA(), staleTime: Infinity });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const g = q.data;
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, md: 5 }}>
        {[
          ["Taxable value", g?.taxableValuePaise],
          ["CGST", g?.cgstPaise],
          ["SGST", g?.sgstPaise],
          ["IGST", g?.igstPaise],
          ["Total tax", g?.totalTaxPaise],
        ].map(([label, v]) => (
          <Card key={label as string} padding="md">
            <Text size="sm" c="dimmed">{label}</Text>
            {q.isPending ? <Skeleton h={24} mt={8} /> : <Text mt={8} className="figure" ff="heading" fz={20}>{rupees(v as number)}</Text>}
          </Card>
        ))}
      </SimpleGrid>
      {ca.data && ca.data.length > 0 && (
        <Alert color="yellow" title="Confirm with the lab's CA before filing">
          <Stack gap={2}>{ca.data.map((x) => <Text key={x} size="sm">{x}</Text>)}</Stack>
        </Alert>
      )}
    </Stack>
  );
}
