"use client";
// One settlement: its invoice lines, deductions, TDS and net, with draft → accrued → paid. Accruing posts a
// journal on the month's last day; paying posts a payment voucher (finance-kit). A paid settlement can't be cancelled.
import { useState } from "react";
import { Alert, Button, Card, Divider, Drawer, Group, Loader, Modal, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { csvBlob, downloadBlob, type Gql } from "@mgpl-diagnostics/client";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { date, dateTime, dayjs, humanize, IST, rupees } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { monthLabel, percent } from "@/lib/settlements";
import { useViewer } from "@/lib/viewer";

const MODES: Gql.PaymentMode[] = ["netbanking", "upi", "cheque", "cash"];
const REFRESH = [["mgpl", "settlements"], ["mgpl", "books"]];

export function SettlementDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["mgpl", "settlements", "one", id], queryFn: () => mgpl.settlements.get(id!), enabled: !!id });
  const s = q.data;
  return (
    <Drawer opened={!!id} onClose={onClose} size="xl" title={s ? `${s.partner.name} · ${monthLabel(s.period)}` : "Settlement"}>
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {s && <SettlementBody s={s} />}
    </Drawer>
  );
}

function SettlementBody({ s }: { s: Gql.Settlement }) {
  const { can } = useViewer();
  const [paying, setPaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const monthOver = dayjs().tz(IST).isAfter(dayjs(s.to));
  const accrue = useAction(() => mgpl.settlements.accrue(s.id), { success: (r) => `Accrued in the books (${r.accrualVoucher?.voucherNo ?? "journal"})`, refresh: REFRESH });
  const cancel = useAction(() => mgpl.settlements.cancel(s.id), { success: "Settlement cancelled", refresh: REFRESH });

  async function exportCsv() {
    setExporting(true);
    try {
      const f = await mgpl.exports.settlement(s.id);
      downloadBlob(csvBlob(f), f.fileName);
    } catch (err) {
      notifications.show({ color: "red", title: "Export failed", message: errorMessage(err) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <Field label="Partner" value={`${s.partner.name} (${s.partner.code})`} />
        <Field label="Status" value={<StatusBadge status={s.status} />} />
        <Field label="Branch" value={s.branch.name} />
        <Field label="Period" value={`${date(s.from)} to ${date(s.to)}`} />
        <Field label="Accrual voucher" value={s.accrualVoucher?.voucherNo ?? "–"} mono />
        <Field label="Payout voucher" value={s.payoutVoucher ? `${s.payoutVoucher.voucherNo}${s.paidAt ? `, ${dateTime(s.paidAt)}` : ""}` : "–"} mono />
      </SimpleGrid>

      <Card padding="md">
        <Stack gap={6}>
          <Line label="Billed through the partner" paise={s.grossPaise} />
          <Line label="Partner's share" paise={s.sharePaise} />
          {s.deductions.map((d, i) => <Line key={`${d.label}-${i}`} label={`Less ${d.label}`} paise={d.amountPaise} />)}
          <Line label={`Less TDS${s.tdsSection ? ` u/s ${s.tdsSection}` : ""} at ${percent(s.tdsRateBp)} on ${rupees(s.tdsBasePaise)}`} paise={s.tdsPaise} />
          <Divider />
          <Line label="Net payable" paise={s.netPaise} strong />
        </Stack>
      </Card>

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={3}>Invoices ({s.lines.length})</Title>
          <Button size="xs" variant="default" leftSection={<DownloadSimpleIcon size={14} />} loading={exporting} onClick={exportCsv}>CSV</Button>
        </Group>
        {s.lines.length === 0 ? (
          <Text size="sm" c="dimmed">No invoices of this partner in the month.</Text>
        ) : (
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr><Table.Th>Day</Table.Th><Table.Th>Invoice</Table.Th><Table.Th>Item</Table.Th><Table.Th ta="right">Net</Table.Th><Table.Th ta="right">Share</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {s.lines.map((l, i) => (
                  <Table.Tr key={`${l.invoiceId}-${i}`}>
                    <Table.Td><Text size="sm" style={{ whiteSpace: "nowrap" }}>{date(l.day)}</Text></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace">{l.invoiceNo}</Text>{l.creditNoteId && <Text size="xs" c="dimmed">credit note</Text>}</Table.Td>
                    <Table.Td><Text size="sm">{l.name}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{rupees(l.netPaise)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{rupees(l.sharePaise)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      {can("accounts:post") && (
        <Group justify="flex-end" gap="xs">
          {(s.status === "draft" || s.status === "accrued") && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              loading={cancel.isPending}
              onClick={() =>
                modals.openConfirmModal({
                  title: "Cancel this settlement?",
                  children: <Text size="sm">{s.status === "accrued" ? "The accrual journal is cancelled in the books. " : ""}You can create the month again afterwards.</Text>,
                  labels: { confirm: "Cancel settlement", cancel: "Keep it" },
                  confirmProps: { color: "red" },
                  onConfirm: () => cancel.mutate(undefined),
                })
              }
            >
              Cancel settlement
            </Button>
          )}
          {s.status === "draft" && (
            <Button size="xs" loading={accrue.isPending} disabled={!monthOver} title={monthOver ? undefined : "A month is accrued after it ends"} onClick={() => accrue.mutate(undefined)}>
              {monthOver ? "Accrue in the books" : "Accrue after the month ends"}
            </Button>
          )}
          {s.status === "accrued" && <Button size="xs" color="tulsi" onClick={() => setPaying(true)}>Record payout of {rupees(s.netPaise)}</Button>}
        </Group>
      )}
      {s.status === "draft" && <Text size="xs" c="dimmed" ta="right">Accruing posts the share, TDS and deductions as a journal on the month&apos;s last day.</Text>}
      {paying && <PayModal s={s} onClose={() => setPaying(false)} />}
    </Stack>
  );
}

function Line({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm" c={strong ? undefined : "dimmed"} fw={strong ? 500 : 400}>{label}</Text>
      <Text size="sm" className="figure" fw={strong ? 600 : 400} c={strong ? "saffron.7" : undefined} style={{ whiteSpace: "nowrap" }}>{rupees(paise)}</Text>
    </Group>
  );
}

function PayModal({ s, onClose }: { s: Gql.Settlement; onClose: () => void }) {
  const form = useForm({
    initialValues: { mode: "netbanking", reference: "", date: dayjs().tz(IST).format("YYYY-MM-DD") as string | null },
    validate: { reference: (v, all) => (all.mode !== "cash" && !v.trim() ? "Add the UTR, UPI or cheque reference" : null) },
  });
  const pay = useAction(
    (v: typeof form.values) =>
      mgpl.settlements.pay({
        settlementId: s.id, mode: v.mode as Gql.PaymentMode,
        ...(v.reference.trim() ? { reference: v.reference.trim() } : {}),
        ...(v.date ? { date: dayjs.tz(v.date, IST).hour(12).toISOString() } : {}),
      }),
    { success: (r) => `Payout recorded (${r.payoutVoucher?.voucherNo ?? "payment voucher"})`, refresh: REFRESH, onDone: onClose },
  );
  return (
    <Modal opened onClose={onClose} title={`Pay ${s.partner.name} ${rupees(s.netPaise)}`}>
      <form onSubmit={form.onSubmit((v) => pay.mutate(v))}>
        <Stack>
          <Select label="Paid by" data={MODES.map((m) => ({ value: m, label: m === "netbanking" ? "Bank transfer" : humanize(m) }))} allowDeselect={false} {...form.getInputProps("mode")} />
          <TextInput label="Reference" description="UTR, UPI reference or cheque number" data-autofocus {...form.getInputProps("reference")} />
          <DateInput label="Paid on" valueFormat="D MMM YYYY" maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} {...form.getInputProps("date")} />
          <Alert color="gray" variant="light">Posts a payment voucher from the partner&apos;s ledger. Pay {rupees(s.netPaise)}: the TDS of {rupees(s.tdsPaise)} is deposited with the government separately.</Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" color="tulsi" loading={pay.isPending}>Record payout</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
