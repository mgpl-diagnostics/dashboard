"use client";
import Link from "next/link";
import { Alert, Button, Drawer, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ReceiptIcon } from "@phosphor-icons/react";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { TubeCap } from "@/components/TubeCap";
import { dateTime, humanize, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction, useBooking } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

/** One booking: tests, samples (with their tube caps), reports and the bill, with the actions the role allows. */
export function BookingDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useViewer();
  const q = useBooking(id);
  const b = q.data;
  const refresh = [["mgpl", "bookings"], ["mgpl", "invoices"]];
  const cancel = useAction((bid: string) => mgpl.bookings.cancel(bid), { success: "Booking cancelled", refresh });
  const bill = useAction(
    (v: { branchId: string; patientId: string; bookingId: string; codes: string[] }) =>
      mgpl.invoices.issue({ branchId: v.branchId, patientId: v.patientId, bookingId: v.bookingId, items: v.codes.map((code) => ({ code, category: "test" })) }),
    { success: (i) => `Invoice ${i.invoiceNo} issued for ${rupees(i.totalPaise)}`, refresh },
  );

  return (
    <Drawer opened={!!id} onClose={onClose} title={b ? `Booking ${b.bookingNo}` : "Booking"} size="lg">
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} />}
      {b && (
        <Stack gap="lg">
          <SimpleGrid cols={2} spacing="sm">
            <Field label="Patient" value={`${b.patient.name} (${b.patient.uhid})`} />
            <Field label="Status" value={<StatusBadge status={b.status} />} />
            <Field label="Branch" value={b.branch.name} />
            <Field label="Referred by" value={b.doctor?.name ?? "Self"} />
            <Field label="Collection" value={`${humanize(b.sampleCollection.type)}${b.sampleCollection.scheduledAt ? `, ${dateTime(b.sampleCollection.scheduledAt)}` : ""}`} />
            <Field label="Booked" value={dateTime(b.createdAt)} />
          </SimpleGrid>
          {b.notes && <Alert color="gray" title="Notes">{b.notes}</Alert>}

          <Stack gap="xs">
            <Title order={3}>Tests</Title>
            <Table verticalSpacing="xs">
              <Table.Tbody>
                {b.tests.map((t) => (
                  <Table.Tr key={t.testCode}>
                    <Table.Td><Text size="sm">{t.name}</Text><Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>{t.testCode}</Text></Table.Td>
                    <Table.Td><TubeCap sampleType={t.sampleType} /></Table.Td>
                    <Table.Td ta="right" className="figure"><Text size="sm">{rupees(t.pricePaise)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={2}><Text size="sm" fw={500}>Total</Text></Table.Td>
                  <Table.Td ta="right" className="figure"><Text size="sm" fw={500}>{rupees(b.tests.reduce((s, t) => s + t.pricePaise, 0))}</Text></Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={3}>Samples</Title>
              {can("sample:read") && <Button component={Link} href={`/samples?booking=${b.id}`} variant="subtle" size="compact-sm">Open in samples</Button>}
            </Group>
            {b.samples.length === 0 ? <Text size="sm" c="dimmed">No samples yet</Text> : (
              <Table verticalSpacing="xs">
                <Table.Tbody>
                  {b.samples.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td><Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{s.barcode}</Text></Table.Td>
                      <Table.Td><TubeCap sampleType={s.sampleType} /></Table.Td>
                      <Table.Td ta="right"><StatusBadge status={s.status} /></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>

          {can("report:read") && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={3}>Reports</Title>
                <Button component={Link} href={`/reports?booking=${b.id}`} variant="subtle" size="compact-sm">Open in reports</Button>
              </Group>
              {b.reports.length === 0 ? <Text size="sm" c="dimmed">No results entered yet</Text> : (
                <Stack gap={6}>
                  {b.reports.map((r) => (
                    <Group key={r.id} justify="space-between"><Text size="sm">{r.testName}</Text><StatusBadge status={r.status} /></Group>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          <Stack gap="xs">
            <Title order={3}>Bill</Title>
            {b.invoice ? (
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.invoice.invoiceNo}</Text>
                  <Text size="xs" c={b.invoice.duePaise > 0 ? "red" : "dimmed"} className="figure">
                    {rupees(b.invoice.totalPaise)}{b.invoice.duePaise > 0 ? `, ${rupees(b.invoice.duePaise)} due` : ", paid"}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <StatusBadge status={b.invoice.status} />
                  {can("invoice:read") && <Button component={Link} href={`/invoices?id=${b.invoice.id}`} size="compact-sm" variant="light">Open</Button>}
                </Group>
              </Group>
            ) : can("invoice:create") && b.status !== "cancelled" ? (
              <Button
                leftSection={<ReceiptIcon size={16} />}
                variant="light"
                loading={bill.isPending}
                onClick={() => bill.mutate({ branchId: b.branch.id, patientId: b.patient.id, bookingId: b.id, codes: b.tests.map((t) => t.testCode) })}
              >
                Issue invoice for these tests
              </Button>
            ) : (
              <Text size="sm" c="dimmed">Not billed yet</Text>
            )}
          </Stack>

          {can("booking:cancel") && b.status !== "cancelled" && b.status !== "completed" && (
            <Group justify="flex-end">
              <Button
                color="red"
                variant="subtle"
                loading={cancel.isPending}
                onClick={() =>
                  modals.openConfirmModal({
                    title: `Cancel booking ${b.bookingNo}?`,
                    children: <Text size="sm">Samples and reports for it stop. A bill, if any, has to be cancelled or refunded in Invoices.</Text>,
                    labels: { confirm: "Cancel booking", cancel: "Keep it" },
                    confirmProps: { color: "red" },
                    onConfirm: () => cancel.mutate(b.id),
                  })
                }
              >
                Cancel booking
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
