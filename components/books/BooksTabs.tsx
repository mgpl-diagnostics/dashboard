"use client";
// Books screens on ledger-kit through the api: balance sheet, cash book, the chart of accounts with ledger
// statements, and vouchers posted by hand. Every amount is integer paise until printed; every voucher balances.
import { useMemo, useState } from "react";
import {
  ActionIcon, Alert, Button, Card, Divider, Drawer, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { DownloadSimpleIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { csvBlob, downloadBlob, type Gql } from "@mgpl-diagnostics/client";
import { Figure } from "@/components/Figure";
import { QueryError } from "@/components/QueryError";
import { date, dayjs, humanize, IST, rupees, rupeesShort, toPaise } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";
import { VoucherDrawer } from "./VoucherDrawer";

async function exportCsv(fn: () => Promise<Gql.CsvFile>) {
  try {
    const f = await fn();
    downloadBlob(csvBlob(f), f.fileName);
  } catch (err) {
    notifications.show({ color: "red", title: "Export failed", message: errorMessage(err) });
  }
}

function CsvButton({ run }: { run: () => Promise<Gql.CsvFile> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="xs" variant="default" leftSection={<DownloadSimpleIcon size={14} />} loading={busy} onClick={async () => { setBusy(true); await exportCsv(run); setBusy(false); }}>
      CSV
    </Button>
  );
}

// ---------------------------------------------------------------- balance sheet

export function BalanceSheetTab({ asOf }: { asOf: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "bs", asOf, b], queryFn: () => mgpl.books.balanceSheet(asOf, b) });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const bs = q.data;
  return (
    <Stack gap="md">
      {bs && bs.differencePaise !== 0 && <Alert color="red" title="The balance sheet doesn't balance">Difference of {rupees(bs.differencePaise)}. Tell the accountant before posting anything else.</Alert>}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">As of {date(asOf)}</Text>
        <CsvButton run={() => mgpl.exports.balanceSheet(asOf, { branchId: b })} />
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Side title="Liabilities and capital" total={bs?.totalLiabilitiesPaise} lines={bs?.liabilities} extra={bs ? { label: "Profit for the period", paise: bs.profitPaise } : undefined} loading={q.isPending} />
        <Side title="Assets" total={bs?.totalAssetsPaise} lines={bs?.assets} loading={q.isPending} />
      </SimpleGrid>
    </Stack>
  );
}

function Side({ title, total, lines, extra, loading }: { title: string; total?: number; lines?: Gql.GroupLine[]; extra?: { label: string; paise: number }; loading: boolean }) {
  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <Title order={2} fz={17}>{title}</Title>
        {loading ? <Skeleton h={24} w={120} /> : <Figure value={total ?? 0} format={rupeesShort} fz={20} />}
      </Group>
      {loading ? <Skeleton h={160} /> : (
        <Stack gap={8}>
          {(lines ?? []).map((g) => (
            <Stack key={g.group.id} gap={2}>
              <Group justify="space-between"><Text size="sm" fw={500}>{g.group.name}</Text><Text size="sm" className="figure" fw={500}>{rupees(g.amountPaise)}</Text></Group>
              {g.ledgers.map((l) => (
                <Group key={l.ledger.id} justify="space-between" pl="md"><Text size="xs" c="dimmed">{l.ledger.name}</Text><Text size="xs" c="dimmed" className="figure">{rupees(l.amountPaise)}</Text></Group>
              ))}
            </Stack>
          ))}
          {extra && <><Divider /><Group justify="space-between"><Text size="sm">{extra.label}</Text><Text size="sm" className="figure" c={extra.paise < 0 ? "red" : undefined}>{rupees(extra.paise)}</Text></Group></>}
          {!lines?.length && !extra && <Text size="sm" c="dimmed">Nothing posted yet</Text>}
        </Stack>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- statements (cash book, ledger)

function StatementTable({ s, loading, onVoucher }: { s?: Gql.LedgerStatement; loading: boolean; onVoucher: (voucherNo: string) => void }) {
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {[["Opening", s?.openingPaise], ["Debits", s?.totalDebitPaise], ["Credits", s?.totalCreditPaise], ["Closing", s?.closingPaise]].map(([label, v]) => (
          <Card key={label as string} padding="sm">
            <Text size="xs" c="dimmed">{label}</Text>
            {loading ? <Skeleton h={20} mt={6} /> : <Text mt={4} className="figure" fw={500}>{rupees(v as number)}</Text>}
          </Card>
        ))}
      </SimpleGrid>
      <DataTable<Gql.StatementRow>
        {...tableLook}
        records={s?.rows ?? []}
        idAccessor={(r) => `${r.voucherNo}-${r.date}-${r.debitPaise}-${r.creditPaise}`}
        fetching={loading}
        noRecordsText="No entries in this period"
        onRowClick={({ record }) => onVoucher(record.voucherNo)}
        columns={[
          { accessor: "date", title: "Date", render: (r) => <Text size="sm" style={{ whiteSpace: "nowrap" }}>{date(r.date)}</Text> },
          { accessor: "voucherNo", title: "Voucher", render: (r) => <><Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{r.voucherNo}</Text><Text size="xs" c="dimmed">{humanize(r.voucherType)}</Text></> },
          { accessor: "debitPaise", title: "Debit", textAlign: "right", render: (r) => <Text size="sm" className="figure">{r.debitPaise ? rupees(r.debitPaise) : ""}</Text> },
          { accessor: "creditPaise", title: "Credit", textAlign: "right", render: (r) => <Text size="sm" className="figure">{r.creditPaise ? rupees(r.creditPaise) : ""}</Text> },
          { accessor: "balancePaise", title: "Balance", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (r) => <Text size="sm" className="figure">{rupees(r.balancePaise)}</Text> },
        ]}
      />
    </Stack>
  );
}

/** Statement rows carry the voucher number; the voucher id comes from the day book of that date. */
function useOpenVoucher(from: string, to: string) {
  const { branchId } = useViewer();
  const [id, setId] = useState<string | null>(null);
  async function open(voucherNo: string) {
    try {
      const all = await mgpl.books.dayBook({ from, to }, { branchId: branchId ?? undefined });
      const v = all.find((x) => x.voucherNo === voucherNo);
      if (v) setId(v.id);
    } catch (err) {
      notifications.show({ color: "red", message: errorMessage(err) });
    }
  }
  return { id, open, close: () => setId(null) };
}

export function CashBookTab({ from, to }: { from: string; to: string }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "cash", from, to, b], queryFn: () => mgpl.books.cashBook({ from, to }, b) });
  const v = useOpenVoucher(from, to);
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <>
      <StatementTable s={q.data} loading={q.isPending} onVoucher={v.open} />
      <VoucherDrawer id={v.id} onClose={v.close} />
    </>
  );
}

// ---------------------------------------------------------------- chart of accounts

export function LedgersTab({ from, to }: { from: string; to: string }) {
  const { can } = useViewer();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Gql.Ledger | null>(null);
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ["mgpl", "books", "ledgers"], queryFn: () => mgpl.books.ledgers() });
  const table = useTable(q.data, { sortBy: "group.name", direction: "asc", search, searchKeys: ["name", "group.name"], pageSize: 50 });
  const setup = useAction(() => mgpl.books.setupChartOfAccounts(), { success: (l) => `Chart of accounts ready (${l.length} ledgers)`, refresh: [["mgpl", "books"]] });

  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <TextInput placeholder="Ledger or group" aria-label="Filter ledgers" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 280 }} />
        {can("accounts:manage") && (
          <Group gap="xs">
            <Button size="xs" variant="default" loading={setup.isPending} onClick={() => setup.mutate(undefined)} title="Adds any standard group or ledger that is missing. Safe to repeat.">Add missing standard ledgers</Button>
            <Button size="xs" leftSection={<PlusIcon size={14} />} onClick={() => setAdding(true)}>Add ledger</Button>
          </Group>
        )}
      </Group>
      <DataTable<Gql.Ledger>
        {...tableLook}
        {...table}
        fetching={q.isPending}
        noRecordsText="No ledgers yet. Add the standard chart of accounts first"
        onRowClick={({ record }) => setOpen(record)}
        columns={[
          { accessor: "name", title: "Ledger", sortable: true, render: (l) => <Text size="sm" fw={500}>{l.name}</Text> },
          { accessor: "group.name", title: "Group", sortable: true },
          { accessor: "group.nature", title: "Nature", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (l) => humanize(l.group.nature) },
          { accessor: "openingPaise", title: "Opening", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (l) => <Text size="sm" className="figure">{l.openingPaise ? rupees(l.openingPaise) : "–"}</Text> },
        ]}
      />
      <LedgerDrawer ledger={open} from={from} to={to} onClose={() => setOpen(null)} />
      {adding && <NewLedger onClose={() => setAdding(false)} />}
    </Stack>
  );
}

function LedgerDrawer({ ledger, from, to, onClose }: { ledger: Gql.Ledger | null; from: string; to: string; onClose: () => void }) {
  const { branchId } = useViewer();
  const b = branchId ?? undefined;
  const q = useQuery({ queryKey: ["mgpl", "books", "ledgerStatement", ledger?.id, from, to, b], queryFn: () => mgpl.books.ledgerStatement(ledger!.id, { from, to }, b), enabled: !!ledger });
  const v = useOpenVoucher(from, to);
  return (
    <Drawer opened={!!ledger} onClose={onClose} size="xl" title={ledger ? `${ledger.name} · ${ledger.group.name}` : "Ledger"}>
      {ledger && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{date(from)} to {date(to)}</Text>
            <CsvButton run={() => mgpl.exports.ledger(ledger.id, { from, to }, { branchId: b })} />
          </Group>
          {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : <StatementTable s={q.data} loading={q.isPending} onVoucher={v.open} />}
        </Stack>
      )}
      <VoucherDrawer id={v.id} onClose={v.close} />
    </Drawer>
  );
}

function NewLedger({ onClose }: { onClose: () => void }) {
  const groups = useQuery({ queryKey: ["mgpl", "books", "groups"], queryFn: () => mgpl.books.groups(), staleTime: 10 * 60_000 });
  const form = useForm({
    initialValues: { name: "", groupId: "", opening: "" as number | "", gstin: "" },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Name the ledger" : null),
      groupId: (v) => (v ? null : "Pick its group"),
      gstin: (v) => (v && !/^\d{2}[A-Z0-9]{13}$/.test(v.trim().toUpperCase()) ? "GSTIN is 15 characters" : null),
    },
  });
  const save = useAction(
    (v: typeof form.values) => mgpl.books.createLedger({ name: v.name.trim(), groupId: v.groupId, ...(v.opening !== "" ? { openingPaise: toPaise(Number(v.opening)) } : {}), ...(v.gstin.trim() ? { gstin: v.gstin.trim().toUpperCase() } : {}) }),
    { success: (l) => `Ledger ${l.name} added`, refresh: [["mgpl", "books"]], onDone: onClose },
  );
  const data = (groups.data ?? []).map((g) => ({ value: g.id, label: g.parent ? `${g.name} (under ${g.parent.name})` : g.name }));
  return (
    <Modal opened onClose={onClose} title="Add a ledger">
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <TextInput label="Name" placeholder="Electricity, HDFC current account…" data-autofocus {...form.getInputProps("name")} />
          <Select label="Group" searchable data={data} placeholder={groups.isPending ? "Loading" : "Indirect Expenses, Bank Accounts…"} {...form.getInputProps("groupId")} />
          <NumberInput label="Opening balance (Rs)" description="Debit for assets and expenses, credit for liabilities and income" decimalScale={2} thousandSeparator="," {...form.getInputProps("opening")} />
          <TextInput label="GSTIN" description="For suppliers, if any" maxLength={15} {...form.getInputProps("gstin")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Add ledger</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- vouchers by hand

const TYPES: { value: Gql.VoucherType; label: string; hint: string }[] = [
  { value: "payment", label: "Payment", hint: "Money paid out: Dr the expense or party, Cr cash or bank" },
  { value: "receipt", label: "Receipt", hint: "Money received: Dr cash or bank, Cr the party or income" },
  { value: "contra", label: "Contra", hint: "Between cash and bank: cash deposited, cash withdrawn" },
  { value: "journal", label: "Journal", hint: "Adjustments with no cash or bank" },
  { value: "purchase", label: "Purchase", hint: "Bought on credit: Dr purchases or expense, Cr the supplier" },
];

interface Entry { ledgerId: string | null; side: "dr" | "cr"; amount: number | "" }

export function NewVoucher({ onClose, onPosted }: { onClose: () => void; onPosted: (v: Gql.Voucher) => void }) {
  const { branches, workBranchId } = useViewer();
  const ledgers = useQuery({ queryKey: ["mgpl", "books", "ledgers"], queryFn: () => mgpl.books.ledgers() });
  const [type, setType] = useState<Gql.VoucherType>("payment");
  const [branchId, setBranchId] = useState<string | null>(workBranchId);
  const [day, setDay] = useState<string | null>(dayjs().tz(IST).format("YYYY-MM-DD"));
  const [narration, setNarration] = useState("");
  const [entries, setEntries] = useState<Entry[]>([{ ledgerId: null, side: "dr", amount: "" }, { ledgerId: null, side: "cr", amount: "" }]);
  const options = useMemo(() => (ledgers.data ?? []).filter((l) => l.active).map((l) => ({ value: l.id, label: `${l.name} · ${l.group.name}` })), [ledgers.data]);
  const sum = (side: "dr" | "cr") => entries.filter((e) => e.side === side && e.amount !== "").reduce((s, e) => s + toPaise(Number(e.amount)), 0);
  const dr = sum("dr");
  const cr = sum("cr");
  const filled = entries.filter((e) => e.ledgerId && e.amount !== "" && Number(e.amount) > 0);
  const ready = !!branchId && !!day && filled.length >= 2 && dr === cr && dr > 0;
  const post = useAction(
    () =>
      mgpl.books.postVoucher({
        branchId: branchId!, type, date: dayjs.tz(day!, IST).hour(12).toISOString(), ...(narration.trim() ? { narration: narration.trim() } : {}),
        entries: filled.map((e) => (e.side === "dr" ? { ledgerId: e.ledgerId!, debitPaise: toPaise(Number(e.amount)) } : { ledgerId: e.ledgerId!, creditPaise: toPaise(Number(e.amount)) })),
      }),
    { success: (v) => `Voucher ${v.voucherNo} posted`, refresh: [["mgpl", "books"]], onDone: onPosted },
  );
  const set = (i: number, patch: Partial<Entry>) => setEntries((all) => all.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <Modal opened onClose={onClose} title="Post a voucher" size="xl">
      <Stack gap="sm">
        <SegmentedControl value={type} onChange={(v) => setType(v as Gql.VoucherType)} data={TYPES.map((t) => ({ value: t.value, label: t.label }))} style={{ overflowX: "auto", maxWidth: "100%" }} />
        <Text size="xs" c="dimmed">{TYPES.find((t) => t.value === type)?.hint}</Text>
        <SimpleGrid cols={{ base: 1, sm: branches.length > 1 ? 2 : 1 }} spacing="sm">
          {branches.length > 1 && <Select label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} allowDeselect={false} />}
          <DateInput label="Date" valueFormat="D MMM YYYY" value={day} onChange={setDay} maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} />
        </SimpleGrid>
        <Stack gap={6}>
          {entries.map((e, i) => (
            <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
              <SegmentedControl size="xs" value={e.side} onChange={(v) => set(i, { side: v as "dr" | "cr" })} data={[{ value: "dr", label: "Dr" }, { value: "cr", label: "Cr" }]} />
              <Select aria-label="Ledger" placeholder={ledgers.isPending ? "Loading" : "Ledger"} searchable data={options} value={e.ledgerId} onChange={(v) => set(i, { ledgerId: v })} style={{ flex: 1, minWidth: 0 }} />
              <NumberInput aria-label="Amount (Rs)" placeholder="Rs" min={0} decimalScale={2} thousandSeparator="," value={e.amount} onChange={(v) => set(i, { amount: typeof v === "number" ? v : "" })} w={140} />
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Remove line" disabled={entries.length <= 2} onClick={() => setEntries((all) => all.filter((_, j) => j !== i))}><TrashIcon size={16} /></ActionIcon>
            </Group>
          ))}
          <Button variant="subtle" size="xs" w="fit-content" leftSection={<PlusIcon size={14} />} onClick={() => setEntries((all) => [...all, { ledgerId: null, side: dr > cr ? "cr" : "dr", amount: "" }])}>Add a line</Button>
        </Stack>
        <Group justify="space-between">
          <Text size="sm" className="figure">Dr {rupees(dr)} · Cr {rupees(cr)}</Text>
          {dr !== cr && <Text size="sm" c="red" className="figure">Off by {rupees(Math.abs(dr - cr))}</Text>}
        </Group>
        <Textarea label="Narration" autosize minRows={2} value={narration} onChange={(e) => setNarration(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={post.isPending} disabled={!ready} onClick={() => post.mutate(undefined)}>Post voucher</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

