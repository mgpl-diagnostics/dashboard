"use client";
// Day-end cash closing (accounts:post), lock dates and the financial-year close (accounts:manage), from
// finance-kit. A lock stops posting, cancelling or editing on or before its date, inside the same transaction.
import { useMemo, useState } from "react";
import { Alert, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Table, Tabs, Text, Textarea, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { LockKeyIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { date, dateTime, dayjs, IST, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function ClosePage() {
  return (
    <Guard permission="accounts:read">
      <Enter>
        <PageHeader title="Day close and periods" description="Count the cash each evening, lock finished periods, close the year" />
        <Tabs defaultValue="cash" keepMounted={false} data-enter>
          <Tabs.List mb="md">
            <Tabs.Tab value="cash">Cash day close</Tabs.Tab>
            <Tabs.Tab value="locks">Lock dates</Tabs.Tab>
            <Tabs.Tab value="year">Year close</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="cash"><CashClose /></Tabs.Panel>
          <Tabs.Panel value="locks"><LockDates /></Tabs.Panel>
          <Tabs.Panel value="year"><YearClose /></Tabs.Panel>
        </Tabs>
      </Enter>
    </Guard>
  );
}

// ---------------------------------------------------------------- cash

const NOTES = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

function CashClose() {
  const { can, workBranchId, branches } = useViewer();
  const [branchId, setBranchId] = useState<string | null>(workBranchId);
  const [closing, setClosing] = useState(false);
  const q = useQuery({ queryKey: ["mgpl", "cash", branchId], queryFn: () => mgpl.cash.closings(branchId!, { limit: 200 }), enabled: !!branchId });
  const table = useTable(q.data, { sortBy: "day", direction: "desc" });
  return (
    <Stack gap="md">
      <Group justify="space-between">
        {branches.length > 1 ? <Select aria-label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} value={branchId} onChange={setBranchId} allowDeselect={false} w={220} /> : <span />}
        {can("accounts:post") && branchId && <Button leftSection={<PlusIcon size={16} />} onClick={() => setClosing(true)}>Close a day</Button>}
      </Group>
      {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Gql.CashClosing>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No day closed yet"
          columns={[
            { accessor: "day", title: "Day", sortable: true, render: (c) => date(c.day) },
            { accessor: "bookPaise", title: "Cash per books", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (c) => <Text size="sm" className="figure">{rupees(c.bookPaise)}</Text> },
            { accessor: "countedPaise", title: "Counted", textAlign: "right", render: (c) => <Text size="sm" className="figure">{rupees(c.countedPaise)}</Text> },
            { accessor: "differencePaise", title: "Short or excess", textAlign: "right", render: (c) => <Text size="sm" className="figure" c={c.differencePaise < 0 ? "red" : c.differencePaise > 0 ? "saffron.7" : undefined}>{c.differencePaise === 0 ? "Tallies" : `${c.differencePaise < 0 ? "Short" : "Over"} ${rupees(Math.abs(c.differencePaise))}`}</Text> },
            { accessor: "voucher.voucherNo", title: "Voucher", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (c) => <Text size="sm" ff="monospace">{c.voucher?.voucherNo ?? "–"}</Text> },
            { accessor: "notes", title: "Notes", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (c) => <Text size="sm" lineClamp={1} maw={240}>{c.notes ?? ""}</Text> },
          ]}
        />
      )}
      {closing && branchId && <CloseDay branchId={branchId} onClose={() => setClosing(false)} />}
    </Stack>
  );
}

function CloseDay({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [day, setDay] = useState<string | null>(dayjs().tz(IST).format("YYYY-MM-DD"));
  const [counts, setCounts] = useState<Record<number, number | "">>({});
  const [coins, setCoins] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const counted = NOTES.reduce((s, v) => s + v * Number(counts[v] || 0), 0) + toPaise(Number(coins || 0));
  const close = useAction(
    () =>
      mgpl.cash.closeDay({
        branchId, day: day!, countedPaise: counted,
        denominations: NOTES.filter((v) => Number(counts[v] || 0) > 0).map((v) => ({ valuePaise: v, count: Number(counts[v]) })),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    {
      success: (c) => (c.differencePaise === 0 ? "Cash tallies with the books" : `Closed with ${c.differencePaise < 0 ? "a shortage" : "an excess"} of ${rupees(Math.abs(c.differencePaise))}, posted to Cash Short / Excess`),
      refresh: [["mgpl", "cash"], ["mgpl", "books"]],
      onDone: onClose,
    },
  );
  return (
    <Modal opened onClose={onClose} title="Close the day's cash" size="lg">
      <Stack gap="sm">
        <DateInput label="Day" valueFormat="D MMM YYYY" value={day} onChange={setDay} maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} w={200} />
        <Text size="sm" fw={500}>Count the cash in the drawer</Text>
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
          {NOTES.map((v) => (
            <NumberInput key={v} label={`Rs ${v / 100} notes`} min={0} allowDecimal={false} value={counts[v] ?? ""} onChange={(n) => setCounts((all) => ({ ...all, [v]: typeof n === "number" ? n : "" }))} />
          ))}
          <NumberInput label="Coins (Rs)" min={0} decimalScale={2} value={coins} onChange={(n) => setCoins(typeof n === "number" ? n : "")} />
        </SimpleGrid>
        <Card padding="sm"><Group justify="space-between"><Text size="sm">Counted</Text><Text fw={600} className="figure">{rupees(counted)}</Text></Group></Card>
        <Textarea label="Notes" description="Why it is short or over, if it is" autosize minRows={1} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text size="xs" c="dimmed">The books&apos; cash for the day is worked out on the server. A difference is posted to Cash Short / Excess.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={close.isPending} disabled={!day} onClick={() => close.mutate(undefined)}>Close the day</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------- lock dates

function LockDates() {
  const { can } = useViewer();
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ["mgpl", "books", "locks"], queryFn: () => mgpl.periods.lockDates() });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">Nothing can be posted, cancelled or changed on or before a lock date. Lock a month once its GST is filed.</Text>
        {can("accounts:manage") && <Button leftSection={<LockKeyIcon size={16} />} onClick={() => setEditing(true)}>Set a lock date</Button>}
      </Group>
      <DataTable<Gql.PeriodLock>
        {...tableLook}
        records={q.data ?? []}
        fetching={q.isPending}
        noRecordsText="No lock dates: every period is open"
        columns={[
          { accessor: "scope", title: "Applies to", render: (l) => l.branch?.name ?? "Whole organisation" },
          { accessor: "lockedUpTo", title: "Locked up to", render: (l) => (l.lockedUpTo ? <Text size="sm" fw={500}>{date(l.lockedUpTo)}</Text> : <Text size="sm" c="dimmed">Open</Text>) },
          { accessor: "reason", title: "Reason", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (l) => l.reason ?? "" },
          { accessor: "updatedAt", title: "Changed", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (l) => dateTime(l.updatedAt) },
        ]}
      />
      {editing && <SetLock onClose={() => setEditing(false)} />}
    </Stack>
  );
}

function SetLock({ onClose }: { onClose: () => void }) {
  const { branches } = useViewer();
  const [scope, setScope] = useState<string>("org");
  const [upTo, setUpTo] = useState<string | null>(dayjs().tz(IST).subtract(1, "month").endOf("month").format("YYYY-MM-DD"));
  const [reason, setReason] = useState("");
  const save = useAction(
    (unlock: boolean) => mgpl.periods.setLockDate({ ...(scope !== "org" ? { branchId: scope } : {}), upTo: unlock ? null : upTo, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    { success: (l) => (l.lockedUpTo ? `Locked up to ${date(l.lockedUpTo)}` : "Unlocked"), refresh: [["mgpl", "books"]], onDone: onClose },
  );
  return (
    <Modal opened onClose={onClose} title="Set a lock date">
      <Stack gap="sm">
        <Select label="Applies to" data={[{ value: "org", label: "Whole organisation" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]} value={scope} onChange={(v) => setScope(v ?? "org")} allowDeselect={false} />
        <DateInput label="Lock up to and including" valueFormat="D MMM YYYY" value={upTo} onChange={setUpTo} maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} />
        <Textarea label="Reason" placeholder="GSTR-1 for October filed" autosize minRows={1} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="space-between">
          <Button variant="subtle" color="red" onClick={() => modals.openConfirmModal({ title: "Remove the lock?", children: <Text size="sm">Every period of this scope becomes open to posting and changes again.</Text>, labels: { confirm: "Unlock", cancel: "Keep the lock" }, confirmProps: { color: "red" }, onConfirm: () => save.mutate(true) })}>Unlock</Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button loading={save.isPending} disabled={!upTo} onClick={() => save.mutate(false)}>Lock</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------- year close

/** Financial years that have ended (April–March), newest first: "2025-26". */
function endedYears(n = 4) {
  const now = dayjs().tz(IST);
  const current = now.month() >= 3 ? now.year() : now.year() - 1;
  return Array.from({ length: n }, (_, i) => current - 1 - i).map((y) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`);
}

function YearClose() {
  const { can } = useViewer();
  const years = useMemo(() => endedYears(), []);
  const [fy, setFy] = useState<string | null>(years[0] ?? null);
  const [result, setResult] = useState<Gql.YearEndResult | null>(null);
  const close = useAction((y: string) => mgpl.periods.closeFinancialYear(y), {
    success: (r) => `Year closed with net ${r.netProfitPaise >= 0 ? "profit" : "loss"} of ${rupees(Math.abs(r.netProfitPaise))}`,
    refresh: [["mgpl", "books"]],
    onDone: setResult,
  });
  return (
    <Stack gap="md" maw={640}>
      <Alert color="gray" variant="light" title="What closing a year does">
        Posts closing vouchers on 31 March that move income and expenses to Profit &amp; Loss A/c, then locks the year. Do it once the accounts are final and the CA has reviewed them.
      </Alert>
      {can("accounts:manage") ? (
        <Group align="flex-end">
          <Select label="Financial year" data={years} value={fy} onChange={setFy} allowDeselect={false} w={180} />
          <Button
            color="red"
            loading={close.isPending}
            disabled={!fy}
            onClick={() =>
              modals.openConfirmModal({
                title: `Close financial year ${fy}?`,
                children: <Text size="sm">Closing vouchers are posted on 31 March and the year is locked. To change anything afterwards, an owner must remove the lock and cancel the closing vouchers.</Text>,
                labels: { confirm: `Close ${fy}`, cancel: "Not yet" },
                confirmProps: { color: "red" },
                onConfirm: () => fy && close.mutate(fy),
              })
            }
          >
            Close the year
          </Button>
        </Group>
      ) : (
        <Text size="sm" c="dimmed">Closing a year needs the accounts:manage permission.</Text>
      )}
      {result && (
        <Card>
          <Title order={3} mb="xs">Closing vouchers</Title>
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {result.vouchers.map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td><Text size="sm" ff="monospace">{v.voucherNo}</Text></Table.Td>
                  <Table.Td><Text size="sm">{date(v.date)}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" className="figure">{rupees(v.entries.reduce((s, e) => s + e.debitPaise, 0))}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
