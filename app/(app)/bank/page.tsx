"use client";
// Bank reconciliation (finance-kit): import the bank's CSV statement, match its lines to our postings
// automatically (amount, date, reference; card and UPI settlements less MDR), match the rest by hand,
// and read the bank reconciliation statement. Importing and matching need accounts:post.
import { useMemo, useState } from "react";
import { Alert, Button, Card, FileButton, Group, Modal, MultiSelect, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "mantine-datatable";
import { ArrowsClockwiseIcon, FileCsvIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { date, dayjs, IST, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function BankPage() {
  return (
    <Guard permission="accounts:read">
      <Bank />
    </Guard>
  );
}

const isBank = (l: Gql.Ledger) => /bank/i.test(l.group.name) && !/charges|od|overdraft/i.test(l.group.name);

function Bank() {
  const { can } = useViewer();
  const ledgers = useQuery({ queryKey: ["mgpl", "books", "ledgers"], queryFn: () => mgpl.books.ledgers() });
  const banks = useMemo(() => (ledgers.data ?? []).filter((l) => l.active && isBank(l)), [ledgers.data]);
  const [picked, setPicked] = useState<string | null>(null);
  const ledgerId = picked ?? banks[0]?.id ?? null;
  const refresh = [["mgpl", "bank"], ["mgpl", "books"]];
  const reconcile = useAction(() => mgpl.bank.reconcile(ledgerId!), {
    success: (r) => `${r.matched} lines matched${r.settlements ? `, ${r.settlements} card or UPI settlements posted with their fee` : ""}. ${r.unmatched} left to match by hand`,
    refresh,
  });

  return (
    <Enter>
      <PageHeader
        title="Bank"
        description="Import the bank's statement and match it to the books"
        actions={
          <>
            <Select aria-label="Bank account" placeholder={ledgers.isPending ? "Loading" : "Bank account"} data={banks.map((l) => ({ value: l.id, label: l.name }))} value={ledgerId} onChange={setPicked} allowDeselect={false} w={240} />
            {can("accounts:post") && ledgerId && <ImportButton ledgerId={ledgerId} />}
            {can("accounts:post") && ledgerId && <Button variant="default" leftSection={<ArrowsClockwiseIcon size={16} />} loading={reconcile.isPending} onClick={() => reconcile.mutate(undefined)}>Match automatically</Button>}
          </>
        }
      />
      {ledgers.isError && <QueryError error={ledgers.error} retry={() => ledgers.refetch()} />}
      {ledgers.isSuccess && !banks.length && <Alert color="gray" data-enter>No bank account ledger yet. Add one in Accounts, Ledgers, under the Bank Accounts group.</Alert>}
      {ledgerId && <Reconciliation key={ledgerId} ledgerId={ledgerId} />}
    </Enter>
  );
}

function ImportButton({ ledgerId }: { ledgerId: string }) {
  const { workBranchId } = useViewer();
  const run = useAction(
    async (file: File) => mgpl.bank.import({ branchId: workBranchId!, ledgerId, csv: await file.text(), fileName: file.name }),
    { success: (r) => `${r.added} lines added${r.skipped ? `, ${r.skipped} already imported` : ""}. Run Match automatically next`, refresh: [["mgpl", "bank"]] },
  );
  return (
    <FileButton accept=".csv,text/csv" onChange={(f) => {
      if (!f) return;
      if (!workBranchId) return notifications.show({ color: "red", message: "Pick a branch first" });
      run.mutate(f);
    }}>
      {(props) => <Button {...props} leftSection={<FileCsvIcon size={16} />} loading={run.isPending}>Import statement</Button>}
    </FileButton>
  );
}

function Reconciliation({ ledgerId }: { ledgerId: string }) {
  const asOf = dayjs().tz(IST).endOf("day").toISOString();
  const brs = useQuery({ queryKey: ["mgpl", "bank", "brs", ledgerId, asOf.slice(0, 10)], queryFn: () => mgpl.bank.reconciliation(ledgerId, asOf) });
  const [status, setStatus] = useState<Gql.BankLineStatus>("unmatched");
  const r = brs.data;
  return (
    <Stack gap="md" data-enter>
      {brs.isError && <QueryError error={brs.error} retry={() => brs.refetch()} />}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {[
          { label: "Balance in our books", v: r?.bookPaise },
          { label: "Balance per bank", v: r?.bankPaise },
          { label: "Payments not yet presented", v: r?.paymentsNotPresentedPaise },
          { label: "Deposits not yet credited", v: r?.depositsNotCreditedPaise },
        ].map((x) => (
          <Card key={x.label} padding="md">
            <Text size="sm" c="dimmed">{x.label}</Text>
            {brs.isPending ? <Skeleton h={24} mt={8} /> : <Text mt={8} className="figure" ff="heading" fz={20}>{x.v == null ? "No statement" : rupees(x.v)}</Text>}
          </Card>
        ))}
      </SimpleGrid>
      {r && r.differencePaise != null && (
        <Alert color={r.differencePaise === 0 ? "tulsi" : "saffron"} variant="light" title={r.differencePaise === 0 ? "Reconciled" : `Difference of ${rupees(r.differencePaise)}`}>
          {r.reconciled.lines} lines matched for {rupees(r.reconciled.amountPaise)}.
          {r.bankCreditsNotInBooksPaise ? ` Bank credits not in the books: ${rupees(r.bankCreditsNotInBooksPaise)}.` : ""}
          {r.bankDebitsNotInBooksPaise ? ` Bank debits not in the books: ${rupees(r.bankDebitsNotInBooksPaise)}.` : ""}
          {r.differencePaise !== 0 ? " Match or post the lines below." : ""}
        </Alert>
      )}
      <SegmentedControl value={status} onChange={(v) => setStatus(v as Gql.BankLineStatus)} data={[{ value: "unmatched", label: "To match" }, { value: "matched", label: "Matched" }, { value: "ignored", label: "Ignored" }]} w="fit-content" />
      <Lines ledgerId={ledgerId} status={status} entries={r?.unreconciledEntries ?? []} />
    </Stack>
  );
}

type Entry = Gql.BankReconciliation["unreconciledEntries"][number];

function Lines({ ledgerId, status, entries }: { ledgerId: string; status: Gql.BankLineStatus; entries: Entry[] }) {
  const { can } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "bank", "lines", ledgerId, status], queryFn: () => mgpl.bank.lines({ ledgerId, status, limit: 200 }) });
  const table = useTable(q.data, { sortBy: "date", direction: "asc", pageSize: 50 });
  const [matching, setMatching] = useState<Gql.BankLine | null>(null);
  const setLine = useAction((v: { id: string; status: "ignored" | "unmatched" }) => mgpl.bank.setStatus(v.id, v.status), { refresh: [["mgpl", "bank"]] });
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <>
      <DataTable<Gql.BankLine>
        {...tableLook}
        {...table}
        fetching={q.isPending}
        noRecordsText={status === "unmatched" ? "Nothing left to match" : "No lines"}
        columns={[
          { accessor: "date", title: "Date", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (l) => <Text size="sm" style={{ whiteSpace: "nowrap" }}>{date(l.date)}</Text> },
          { accessor: "description", title: "Narration", render: (l) => <><Text size="xs" c="dimmed" hiddenFrom="sm">{date(l.date)}</Text><Text size="sm" lineClamp={2} maw={360}>{l.description}</Text>{l.reference && <Text size="xs" c="dimmed" ff="monospace">{l.reference}</Text>}</> },
          { accessor: "amount", title: "Amount", textAlign: "right", visibleMediaQuery: (t) => `(max-width: calc(${t.breakpoints.md} - 1px))`, render: (l) => <Text size="sm" className="figure" style={{ whiteSpace: "nowrap" }}>{l.debitPaise ? `Out ${rupees(l.debitPaise)}` : `In ${rupees(l.creditPaise)}`}</Text> },
          { accessor: "debitPaise", title: "Withdrawal", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (l) => <Text size="sm" className="figure">{l.debitPaise ? rupees(l.debitPaise) : ""}</Text> },
          { accessor: "creditPaise", title: "Deposit", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (l) => <Text size="sm" className="figure">{l.creditPaise ? rupees(l.creditPaise) : ""}</Text> },
          {
            accessor: "status", title: "", textAlign: "right",
            render: (l) =>
              l.status === "unmatched" && can("accounts:post") ? (
                <Group gap={4} justify="flex-end">
                  <Button size="compact-xs" variant="light" onClick={() => setMatching(l)}>Match</Button>
                  <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setLine.mutate({ id: l.id, status: "ignored" })}>Ignore</Button>
                </Group>
              ) : l.status === "ignored" && can("accounts:post") ? (
                <Button size="compact-xs" variant="subtle" onClick={() => setLine.mutate({ id: l.id, status: "unmatched" })}>Back to match</Button>
              ) : (
                <Group gap={4} justify="flex-end" wrap="nowrap"><StatusBadge status={l.status} />{l.settlement && <Text size="xs" c="dimmed">fee {rupees(l.settlement.feePaise)}</Text>}</Group>
              ),
          },
        ]}
      />
      {matching && <MatchLine line={matching} entries={entries} onClose={() => setMatching(null)} />}
    </>
  );
}

/** Matches one bank line to one or more postings of the same side whose amounts add up to it. */
function MatchLine({ line, entries, onClose }: { line: Gql.BankLine; entries: Entry[]; onClose: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  // A deposit matches debits to the bank ledger; a withdrawal matches credits.
  const side = entries.filter((e) => (line.creditPaise ? e.debitPaise > 0 : e.creditPaise > 0));
  const amount = (e: Entry) => e.debitPaise || e.creditPaise;
  const target = line.creditPaise || line.debitPaise;
  const total = side.filter((e) => ids.includes(e.voucherId)).reduce((s, e) => s + amount(e), 0);
  const match = useAction(() => mgpl.bank.match(line.id, ids), { success: "Matched", refresh: [["mgpl", "bank"]], onDone: onClose });
  return (
    <Modal opened onClose={onClose} title={`Match ${rupees(target)} on ${date(line.date)}`} size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">{line.description}</Text>
        <MultiSelect
          label="Postings in our books"
          placeholder={side.length ? "Voucher number or amount" : "No unmatched postings on this side"}
          searchable
          data={side.map((e) => ({ value: e.voucherId, label: `${e.voucherNo} · ${date(e.date)} · ${rupees(amount(e))}` }))}
          value={ids}
          onChange={setIds}
        />
        <Group justify="space-between">
          <Text size="sm" className="figure" c={total === target ? "tulsi.8" : undefined}>Chosen {rupees(total)} of {rupees(target)}</Text>
          {ids.length > 0 && total !== target && <Text size="sm" c="red">Amounts don&apos;t add up</Text>}
        </Group>
        <Text size="xs" c="dimmed">Not in the books yet (bank charges, interest)? Post a voucher in Accounts first, then match it here.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={match.isPending} disabled={!ids.length || total !== target} onClick={() => match.mutate(undefined)}>Match</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

