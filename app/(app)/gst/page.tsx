"use client";
// GST (finance-kit): the month's GSTR-1 and GSTR-3B figures with their CSV files, the tax rules that set
// SAC, taxability and rate per item code or category, and the finance settings in force. Every rate and
// setting is the lab's CA's call: nothing here is prefilled, and the "verify with CA" list stays visible.
import { useState } from "react";
import { Alert, Button, Card, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Table, Tabs, Text, TextInput, Textarea, Title } from "@mantine/core";
import { DatePickerInput, MonthPickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { DownloadSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { csvBlob, downloadBlob, type Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { date, dayjs, humanize, IST, rupees } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { ITEM_CATEGORIES, percent } from "@/lib/settlements";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function GstPage() {
  return (
    <Guard permission="accounts:read">
      <Gst />
    </Guard>
  );
}

function Gst() {
  return (
    <Enter>
      <PageHeader title="GST" description="Monthly returns data, tax rules and the settings your CA confirmed" />
      <CaList />
      <Tabs defaultValue="returns" keepMounted={false} data-enter>
        <Tabs.List mb="md">
          <Tabs.Tab value="returns">Returns</Tabs.Tab>
          <Tabs.Tab value="rules">Tax rules</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="returns"><Returns /></Tabs.Panel>
        <Tabs.Panel value="rules"><Rules /></Tabs.Panel>
        <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
      </Tabs>
    </Enter>
  );
}

function CaList() {
  const ca = useQuery({ queryKey: ["mgpl", "gst", "verifyWithCA"], queryFn: () => mgpl.gst.verifyWithCA(), staleTime: Infinity });
  if (!ca.data?.length) return null;
  return (
    <Alert color="yellow" title="Confirm with the lab's CA before filing" mb="md" data-enter>
      <Stack gap={2}>{ca.data.map((x) => <Text key={x} size="sm">{x}</Text>)}</Stack>
    </Alert>
  );
}

// ---------------------------------------------------------------- returns

const lastMonthStart = () => dayjs().tz(IST).subtract(1, "month").startOf("month").format("YYYY-MM-DD");

async function download(files: Gql.CsvFile | Gql.CsvFile[]) {
  for (const f of Array.isArray(files) ? files : [files]) downloadBlob(csvBlob(f), f.fileName);
}

function CsvButton({ label, run }: { label: string; run: () => Promise<Gql.CsvFile | Gql.CsvFile[]> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="xs" variant="default" leftSection={<DownloadSimpleIcon size={14} />} loading={busy} onClick={async () => {
      setBusy(true);
      try { await download(await run()); } catch (err) { notifications.show({ color: "red", title: "Export failed", message: errorMessage(err) }); }
      setBusy(false);
    }}>{label}</Button>
  );
}

function Returns() {
  const [month, setMonth] = useState<string | null>(lastMonthStart());
  const m = dayjs.tz(month ?? lastMonthStart(), IST);
  const range = { from: m.startOf("month").toISOString(), to: m.endOf("month").toISOString() };
  const r1 = useQuery({ queryKey: ["mgpl", "gst", "gstr1", range.from], queryFn: () => mgpl.gst.gstr1(range) });
  const r3 = useQuery({ queryKey: ["mgpl", "gst", "gstr3b", range.from], queryFn: () => mgpl.gst.gstr3b(range) });
  const g = r1.data;
  const t = r3.data;
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <MonthPickerInput aria-label="Month" value={month} onChange={setMonth} valueFormat="MMMM YYYY" maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} w={200} />
        <Group gap="xs">
          <CsvButton label="GSTR-1 CSV files" run={() => mgpl.exports.gstr1(range)} />
          <CsvButton label="GSTR-3B CSV" run={() => mgpl.exports.gstr3b(range)} />
        </Group>
      </Group>
      {r1.isError && <QueryError error={r1.error} retry={() => r1.refetch()} />}
      {r3.isError && <QueryError error={r3.error} retry={() => r3.refetch()} />}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {[
          ["Taxable value", t?.outwardTaxable.taxablePaise],
          ["CGST + SGST", t ? t.outwardTaxable.cgstPaise + t.outwardTaxable.sgstPaise : undefined],
          ["IGST", t?.outwardTaxable.igstPaise],
          ["Nil rated and exempt", t?.outwardNilExemptPaise],
        ].map(([label, v]) => (
          <Card key={label as string} padding="md">
            <Text size="sm" c="dimmed">{label}</Text>
            {r3.isPending ? <Skeleton h={24} mt={8} /> : <Text mt={8} className="figure" ff="heading" fz={20}>{rupees(v as number)}</Text>}
          </Card>
        ))}
      </SimpleGrid>
      {t && <Text size="sm" c="dimmed">GSTIN {t.gstin || "not set"} · {date(t.period.from)} to {date(t.period.to)}{t.outwardNonGstPaise ? ` · Non-GST supplies ${rupees(t.outwardNonGstPaise)}` : ""}</Text>}
      <Card padding="md">
        <Title order={4} mb="sm">GSTR-1 sections</Title>
        {r1.isPending ? <Skeleton h={160} /> : g && (
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing={6}>
              <Table.Thead><Table.Tr><Table.Th>Section</Table.Th><Table.Th ta="right">Rows</Table.Th><Table.Th ta="right">Taxable</Table.Th><Table.Th ta="right">Tax</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {[
                  ["B2B invoices (4A)", g.b2b.length, sumItems(g.b2b)],
                  ["B2C large (5A)", g.b2cl.length, sumItems(g.b2cl)],
                  ["B2C small (7)", g.b2cs.length, sum(g.b2cs)],
                  ["Credit notes, registered (9B)", g.cdnr.length, sumItems(g.cdnr)],
                  ["Credit notes, unregistered (9B)", g.cdnur.length, sumItems(g.cdnur)],
                  ["HSN / SAC summary (12)", g.hsn.b2b.length + g.hsn.b2c.length, sum([...g.hsn.b2b, ...g.hsn.b2c])],
                ].map((row) => {
                  const [label, n, s] = row as [string, number, Gql.TaxTotals];
                  return (
                    <Table.Tr key={label}>
                      <Table.Td><Text size="sm">{label}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" className="figure">{n}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" className="figure">{rupees(s.taxablePaise)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" className="figure">{rupees(s.cgstPaise + s.sgstPaise + s.igstPaise + s.cessPaise)}</Text></Table.Td>
                    </Table.Tr>
                  );
                })}
                <Table.Tr>
                  <Table.Td><Text size="sm">Nil rated, exempt, non-GST (8)</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" className="figure">{g.nil.length}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" className="figure">{rupees(g.nil.reduce((a, n) => a + n.nilRatedPaise + n.exemptedPaise + n.nonGstPaise, 0))}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" className="figure">{rupees(0)}</Text></Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text size="sm">Documents issued (13)</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" className="figure">{g.docs.reduce((a, d) => a + d.net, 0)}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" c="dimmed">{g.docs.reduce((a, d) => a + d.cancelled, 0)} cancelled</Text></Table.Td>
                  <Table.Td />
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
      {t && t.interStateUnregistered.length > 0 && (
        <Card padding="md">
          <Title order={4} mb="sm">Inter-state supplies to unregistered persons (3.2)</Title>
          <Stack gap={4}>
            {t.interStateUnregistered.map((x) => (
              <Group key={x.placeOfSupply} justify="space-between">
                <Text size="sm">{x.placeOfSupply}</Text>
                <Text size="sm" className="figure">{rupees(x.taxablePaise)} · IGST {rupees(x.igstPaise)}</Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

const ZERO: Gql.TaxTotals = { taxablePaise: 0, igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 };
const sum = (xs: Gql.TaxTotals[]): Gql.TaxTotals =>
  xs.reduce((a, x) => ({ taxablePaise: a.taxablePaise + x.taxablePaise, igstPaise: a.igstPaise + x.igstPaise, cgstPaise: a.cgstPaise + x.cgstPaise, sgstPaise: a.sgstPaise + x.sgstPaise, cessPaise: a.cessPaise + x.cessPaise }), ZERO);
const sumItems = (xs: { items: Gql.TaxTotals[] }[]) => sum(xs.flatMap((x) => x.items));

// ---------------------------------------------------------------- tax rules

const TAXABILITY: { value: Gql.Taxability; label: string }[] = [
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "nil_rated", label: "Nil rated" },
  { value: "non_gst", label: "Non-GST" },
];
const categoryLabel = (c: Gql.ItemCategory | null) => ITEM_CATEGORIES.find((x) => x.value === c)?.label ?? "–";

function Rules() {
  const { can } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "gst", "rules"], queryFn: () => mgpl.gst.taxRules() });
  const table = useTable(q.data, { sortBy: "effectiveFrom", direction: "desc", pageSize: 50 });
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed" maw={640}>A rule for an item code beats a rule for its category; the latest start date wins. Rules are never edited: to change a rate, add a new rule from the date it applies.</Text>
        {can("accounts:manage") && (
          <Group gap="xs">
            {q.data && q.data.length === 0 && <Button variant="default" onClick={() => setSeeding(true)}>Load starting rules</Button>}
            <Button leftSection={<PlusIcon size={16} />} onClick={() => setAdding(true)}>Add rule</Button>
          </Group>
        )}
      </Group>
      <DataTable<Gql.TaxRule>
        {...tableLook}
        {...table}
        fetching={q.isPending}
        noRecordsText="No tax rules yet. Invoices can't be issued until every item has one."
        columns={[
          { accessor: "code", title: "Applies to", render: (r) => (r.code ? <Text size="sm" ff="monospace">{r.code}</Text> : <Text size="sm">{categoryLabel(r.category)}</Text>) },
          { accessor: "hsnSac", title: "SAC / HSN", render: (r) => <Text size="sm" ff="monospace">{r.hsnSac}</Text> },
          { accessor: "taxability", title: "Taxability", render: (r) => TAXABILITY.find((x) => x.value === r.taxability)?.label ?? r.taxability },
          { accessor: "ratePercent", title: "Rate", textAlign: "right", render: (r) => <Text size="sm" className="figure">{r.ratePercent}%</Text> },
          { accessor: "effectiveFrom", title: "From", sortable: true, render: (r) => date(r.effectiveFrom) },
          { accessor: "effectiveTo", title: "To", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (r) => (r.effectiveTo ? date(r.effectiveTo) : "Open") },
          { accessor: "note", title: "Note", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (r) => <Text size="sm" lineClamp={2} maw={320}>{r.note ?? ""}</Text> },
        ]}
      />
      {adding && <AddRule onClose={() => setAdding(false)} />}
      {seeding && <SeedRules onClose={() => setSeeding(false)} />}
    </Stack>
  );
}

function AddRule({ onClose }: { onClose: () => void }) {
  const [by, setBy] = useState<"category" | "code">("category");
  const [category, setCategory] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [hsnSac, setHsnSac] = useState("");
  const [taxability, setTaxability] = useState<string | null>(null);
  const [rate, setRate] = useState<number | "">("");
  const [from, setFrom] = useState<string | null>(dayjs().tz(IST).format("YYYY-MM-DD"));
  const [note, setNote] = useState("");
  const add = useAction(
    () => mgpl.gst.addTaxRule({
      ...(by === "code" ? { code: code.trim() } : { category: category as Gql.ItemCategory }),
      hsnSac: hsnSac.trim(), taxability: taxability as Gql.Taxability, ratePercent: Number(rate), effectiveFrom: from!,
      ...(note.trim() ? { note: note.trim() } : {}),
    }),
    { success: "Tax rule added", refresh: [["mgpl", "gst"]], onDone: onClose },
  );
  const ready = (by === "code" ? code.trim().length > 0 : !!category) && /^\d{4,8}$/.test(hsnSac.trim()) && !!taxability && rate !== "" && !!from;
  return (
    <Modal opened onClose={onClose} title="Add a tax rule" size="md">
      <Stack gap="sm">
        <SegmentedControl value={by} onChange={(v) => setBy(v as "category" | "code")} data={[{ value: "category", label: "A category" }, { value: "code", label: "One item code" }]} />
        {by === "category"
          ? <Select label="Category" data={ITEM_CATEGORIES} value={category} onChange={setCategory} required />
          : <TextInput label="Item code" description="A test, profile or package code from the price list" value={code} onChange={(e) => setCode(e.currentTarget.value)} required />}
        <TextInput label="SAC / HSN" description="4 to 8 digits" value={hsnSac} onChange={(e) => setHsnSac(e.currentTarget.value.replace(/\D/g, ""))} required />
        <Group grow>
          <Select label="Taxability" data={TAXABILITY} value={taxability} onChange={setTaxability} required />
          <NumberInput label="Rate (%)" min={0} max={100} decimalScale={2} value={rate} onChange={(v) => setRate(typeof v === "number" ? v : "")} required />
        </Group>
        <DatePickerInput label="Applies from" value={from} onChange={setFrom} valueFormat="D MMM YYYY" required />
        <Textarea label="Note" description="For example, the CA's advice and its date" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Text size="xs" c="dimmed">Use only the SAC, taxability and rate your CA confirmed.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={add.isPending} disabled={!ready} onClick={() => add.mutate(undefined)}>Add rule</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function SeedRules({ onClose }: { onClose: () => void }) {
  const seed = useAction(() => mgpl.gst.seedTaxRules(), { success: (r) => `${r.length} starting rules loaded. Have the CA confirm each one`, refresh: [["mgpl", "gst"]], onDone: onClose });
  return (
    <Modal opened onClose={onClose} title="Load the starting rules" size="md">
      <Stack gap="sm">
        <Text size="sm">This adds finance-kit&apos;s starting rules for tests, packages and services. They are a starting point, not tax advice.</Text>
        <Alert color="yellow" variant="light">Every rate must be confirmed by the lab&apos;s CA before invoices are filed. To change one later, add a new rule from the date it applies.</Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={seed.isPending} onClick={() => seed.mutate(undefined)}>Load rules</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------- settings

function Settings() {
  const q = useQuery({ queryKey: ["mgpl", "gst", "config"], queryFn: () => mgpl.gst.config() });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  const rows: [string, string][] = c
    ? [
        ["B2C large invoice threshold (GSTR-1 5A)", rupees(c.b2clThresholdPaise)],
        ["TDS section on partner settlements", c.tds.section],
        ["TDS rate", percent(c.tds.rateBp)],
        ["TDS rate without PAN", percent(c.tds.noPanRateBp)],
        ["TDS threshold for the year", c.tds.thresholdPaise == null ? "None" : rupees(c.tds.thresholdPaise)],
        ["Bank matching: days either side", `${c.bankToleranceDays}`],
        ["Bank matching: largest card or UPI fee", percent(c.bankMaxFeeBp)],
        ["Clearing ledgers for card and UPI", c.clearingLedgerKeys.length ? c.clearingLedgerKeys.map(humanize).join(", ") : "None"],
      ]
    : [];
  return (
    <Stack gap="md" maw={720}>
      <Text size="sm" c="dimmed">These values come from finance-kit&apos;s defaults and the organisation&apos;s finance settings. They are set on the server with the CA&apos;s confirmation, not from this page.</Text>
      <Card padding="md">
        {q.isPending ? <Skeleton h={200} /> : (
          <Stack gap={6}>
            {rows.map(([k, v]) => (
              <Group key={k} justify="space-between" wrap="nowrap" gap="md">
                <Text size="sm" c="dimmed">{k}</Text>
                <Text size="sm" className="figure" ta="right">{v}</Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
