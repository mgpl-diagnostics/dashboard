"use client";
// One voucher with its entries; cancel (accounts:post) for vouchers posted by hand. Vouchers of an invoice
// or a settlement are cancelled through that record, so the books and the bill stay in step.
import { Alert, Button, Divider, Drawer, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { dateTime, humanize, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

const BY_HAND = new Set(["journal", "contra", "payment", "receipt", "purchase"]);

export function VoucherDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "books", "voucher", id], queryFn: () => mgpl.books.voucher(id!), enabled: !!id });
  const v = q.data;
  const cancel = useAction((vid: string) => mgpl.books.cancelVoucher(vid), { success: "Voucher cancelled", refresh: [["mgpl", "books"]] });
  const debit = v?.entries.reduce((s, e) => s + e.debitPaise, 0) ?? 0;
  const credit = v?.entries.reduce((s, e) => s + e.creditPaise, 0) ?? 0;
  return (
    <Drawer opened={!!id} onClose={onClose} size="lg" title={v ? `Voucher ${v.voucherNo}` : "Voucher"}>
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {v && (
        <Stack gap="md">
          <Group grow align="flex-start">
            <Field label="Type" value={humanize(v.type)} />
            <Field label="Date" value={dateTime(v.date)} />
            <Field label="Status" value={<StatusBadge status={v.status} />} />
          </Group>
          {v.narration && <Field label="Narration" value={v.narration} />}
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing={4}>
              <Table.Thead><Table.Tr><Table.Th>Ledger</Table.Th><Table.Th ta="right">Debit</Table.Th><Table.Th ta="right">Credit</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {v.entries.map((e, k) => (
                  <Table.Tr key={k}>
                    <Table.Td><Text size="sm">{e.ledger.name}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{e.debitPaise ? rupees(e.debitPaise) : ""}</Text></Table.Td>
                    <Table.Td ta="right"><Text size="sm" className="figure">{e.creditPaise ? rupees(e.creditPaise) : ""}</Text></Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td><Text size="sm" fw={500}>Total</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" fw={500} className="figure">{rupees(debit)}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" fw={500} className="figure">{rupees(credit)}</Text></Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {v.status === "posted" && v.invoiceId && <Alert color="gray" variant="light">This voucher belongs to an invoice. Cancel or credit the invoice instead.</Alert>}
          {v.status === "posted" && !v.invoiceId && BY_HAND.has(v.type) && can("accounts:post") && (
            <>
              <Divider />
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  color="red"
                  loading={cancel.isPending}
                  onClick={() =>
                    modals.openConfirmModal({
                      title: `Cancel ${v.voucherNo}?`,
                      children: <Text size="sm">Its entries leave every report. The number stays used. A period that is locked can&apos;t be changed.</Text>,
                      labels: { confirm: "Cancel voucher", cancel: "Keep it" },
                      confirmProps: { color: "red" },
                      onConfirm: () => cancel.mutate(v.id),
                    })
                  }
                >
                  Cancel voucher
                </Button>
              </Group>
            </>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
