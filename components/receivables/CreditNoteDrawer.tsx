"use client";
// Credit notes (finance-kit): read one, or issue one against an invoice (accounts:post). A credit note
// reduces the invoice and posts to the books; money goes back to the patient only through a refund.
import { useState } from "react";
import { Alert, Button, Checkbox, Divider, Drawer, Group, Loader, Modal, NumberInput, Stack, Table, Text, Textarea } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { date, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";

export function CreditNoteDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["mgpl", "creditNotes", "one", id], queryFn: () => mgpl.receivables.creditNote(id!), enabled: !!id });
  const n = q.data;
  return (
    <Drawer opened={!!id} onClose={onClose} size="lg" title={n ? `Credit note ${n.noteNo}` : "Credit note"}>
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {n && (
        <Stack gap="md">
          <Group grow align="flex-start">
            <Field label="Invoice" value={n.invoice.invoiceNo} mono />
            <Field label="Date" value={date(n.date)} />
          </Group>
          <Group grow align="flex-start">
            <Field label="Customer" value={n.customer ? `${n.customer.name} (${n.customer.code})` : "Patient"} />
            <Field label="Place of supply" value={n.placeOfSupply ?? "–"} />
          </Group>
          <Field label="Reason" value={n.reason} />
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing={4}>
              <Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th ta="right">Taxable</Table.Th><Table.Th ta="right">GST</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {n.lines.map((l) => (
                  <Table.Tr key={l.itemIndex}>
                    <Table.Td><Text size="sm">{l.name}</Text>{l.hsnSac && <Text size="xs" c="dimmed">SAC {l.hsnSac} · {l.taxPercent}%</Text>}</Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{rupees(l.taxablePaise)}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{rupees(l.taxPaise)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Stack gap={4}>
            <Row label="Taxable" paise={n.taxablePaise} />
            {n.cgstPaise > 0 && <Row label="CGST" paise={n.cgstPaise} />}
            {n.sgstPaise > 0 && <Row label="SGST" paise={n.sgstPaise} />}
            {n.igstPaise > 0 && <Row label="IGST" paise={n.igstPaise} />}
            {n.roundOffPaise !== 0 && <Row label="Round off" paise={n.roundOffPaise} />}
            <Divider my={4} />
            <Row label="Credited" paise={n.totalPaise} strong />
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}

function Row({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c={strong ? undefined : "dimmed"} fw={strong ? 500 : 400}>{label}</Text>
      <Text size="sm" className="figure" fw={strong ? 500 : 400}>{rupees(paise)}</Text>
    </Group>
  );
}

interface Pick { on: boolean; amount: number | "" }

/** Issues a credit note against an invoice: whole lines, or part of a line's taxable value. */
export function IssueCreditNote({ invoice, onClose }: { invoice: Gql.Invoice; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [picks, setPicks] = useState<Record<number, Pick>>(() => Object.fromEntries(invoice.items.map((_, i) => [i, { on: false, amount: "" }])));
  const chosen = Object.entries(picks).filter(([, p]) => p.on);
  const issue = useAction(
    () =>
      mgpl.receivables.issueCreditNote({
        invoiceId: invoice.id, reason: reason.trim(),
        lines: chosen.map(([i, p]) => ({ itemIndex: Number(i), ...(p.amount !== "" && p.amount > 0 ? { taxablePaise: toPaise(Number(p.amount)) } : {}) })),
      }),
    {
      success: (r) => `Credit note ${r.creditNote.noteNo} for ${rupees(r.creditNote.totalPaise)}${r.refundablePaise > 0 ? `. ${rupees(r.refundablePaise)} can be refunded` : ""}`,
      refresh: [["mgpl", "invoices"], ["mgpl", "creditNotes"], ["mgpl", "customers"], ["mgpl", "books"]],
      onDone: onClose,
    },
  );
  const set = (i: number, patch: Partial<Pick>) => setPicks((all) => ({ ...all, [i]: { ...all[i]!, ...patch } }));

  return (
    <Modal opened onClose={onClose} title={`Credit note on ${invoice.invoiceNo}`} size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">Pick the lines to credit. Leave the amount empty to credit the whole line, or enter part of its value before GST. GST is worked out the same way as on the invoice.</Text>
        {invoice.items.map((it, i) => (
          <Group key={i} justify="space-between" wrap="nowrap" gap="sm">
            <Checkbox label={<>{it.name} <Text span size="xs" c="dimmed" className="figure">{rupees(it.amountPaise)}</Text></>} checked={picks[i]?.on ?? false} onChange={(e) => set(i, { on: e.currentTarget.checked })} />
            <NumberInput aria-label={`Part of ${it.name} (Rs)`} placeholder="Whole line" min={0} max={it.amountPaise / 100} decimalScale={2} disabled={!picks[i]?.on} value={picks[i]?.amount ?? ""} onChange={(v) => set(i, { amount: typeof v === "number" ? v : "" })} w={130} />
          </Group>
        ))}
        <Textarea label="Reason" description="Printed on the credit note" required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        {invoice.paidPaise > 0 && <Alert color="gray" variant="light">If the invoice was paid, give the money back with Refund on the invoice afterwards.</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" loading={issue.isPending} disabled={!chosen.length || reason.trim().length < 3} onClick={() => issue.mutate(undefined)}>Issue credit note</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
