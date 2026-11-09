"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Divider, Drawer, Group, Loader, Modal, NumberInput, SegmentedControl, Select, Stack, Table, Text, TextInput, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import { FilePdfIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { documentBlob, openBlob, type Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Field } from "@/components/Field";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { dateTime, humanize, rupees, toPaise } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction, useInvoices } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

const MODES: Gql.PaymentMode[] = ["cash", "upi", "card", "netbanking", "wallet", "cheque", "insurance"];

export default function InvoicesPage() {
  return (
    <Guard permission="invoice:read">
      <Suspense>
        <Invoices />
      </Suspense>
    </Guard>
  );
}

function Invoices() {
  const params = useSearchParams();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("id"));
  const q = useInvoices(status ? { status: status as Gql.InvoiceStatus } : {});
  const table = useTable(q.data, { sortBy: "createdAt", search, searchKeys: ["invoiceNo", "patient.name", "patient.uhid"] });
  const due = (q.data ?? []).reduce((s, i) => s + (i.status === "cancelled" ? 0 : i.duePaise), 0);

  return (
    <Enter>
      <PageHeader title="Invoices" description={q.data ? `${rupees(due)} due across the bills shown` : "Patient bills"} />
      <Group data-enter justify="space-between" gap="sm">
        <SegmentedControl
          value={status}
          onChange={setStatus}
          data={[{ value: "", label: "All" }, { value: "issued", label: "Unpaid" }, { value: "partially_paid", label: "Part paid" }, { value: "paid", label: "Paid" }, { value: "cancelled", label: "Cancelled" }]}
          style={{ overflowX: "auto", maxWidth: "100%" }}
        />
        <TextInput placeholder="Invoice no or patient" aria-label="Filter invoices" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 260 }} />
      </Group>
      <div data-enter>
        {q.isError ? (
          <QueryError error={q.error} retry={() => q.refetch()} />
        ) : (
          <DataTable<Gql.Invoice>
            {...tableLook}
            {...table}
            fetching={q.isPending}
            onRowClick={({ record }) => setOpen(record.id)}
            columns={[
              { accessor: "invoiceNo", title: "Invoice", sortable: true, render: (i) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{i.invoiceNo}</Text> },
              { accessor: "patient.name", title: "Patient", sortable: true, render: (i) => <><Text size="sm" fw={500}>{i.patient.name}</Text>{i.customer && <Text size="xs" c="dimmed">{i.customer.name}</Text>}</> },
              { accessor: "totalPaise", title: "Total", textAlign: "right", sortable: true, render: (i) => <Text size="sm" className="figure">{rupees(i.totalPaise)}</Text> },
              { accessor: "duePaise", title: "Due", textAlign: "right", sortable: true, render: (i) => <Text size="sm" className="figure" c={i.duePaise > 0 && i.status !== "cancelled" ? "red" : "dimmed"}>{rupees(i.duePaise)}</Text> },
              { accessor: "status", title: "Status", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (i) => <StatusBadge status={i.status} /> },
              { accessor: "createdAt", title: "Date", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (i) => dateTime(i.issuedAt ?? i.createdAt) },
            ]}
          />
        )}
      </div>
      <InvoiceDrawer id={open} onClose={() => setOpen(null)} />
    </Enter>
  );
}

function InvoiceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "invoices", "one", id], queryFn: () => mgpl.invoices.get(id!), enabled: !!id });
  const [payKind, setPayKind] = useState<"payment" | "refund" | null>(null);
  const [printing, setPrinting] = useState(false);
  const i = q.data;
  const cancel = useAction((v: { id: string; reason: string }) => mgpl.invoices.cancel(v.id, v.reason), { success: "Invoice cancelled and reversed in the books", refresh: [["mgpl", "invoices"], ["mgpl", "bookings"]] });

  async function print() {
    if (!i) return;
    setPrinting(true);
    try {
      openBlob(documentBlob(await mgpl.documents.invoice(i.id, { format: "pdf" })));
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't print", message: errorMessage(err) });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Drawer opened={!!id} onClose={onClose} title={i ? `Invoice ${i.invoiceNo}` : "Invoice"} size="lg">
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} />}
      {i && (
        <Stack gap="lg">
          <Group justify="space-between">
            <StatusBadge status={i.status} />
            <Button size="xs" variant="light" leftSection={<FilePdfIcon size={16} />} loading={printing} onClick={print}>Open PDF</Button>
          </Group>
          <Group grow align="flex-start">
            <Field label="Patient" value={`${i.patient.name} (${i.patient.uhid})`} />
            <Field label="Branch" value={i.branch.name} />
          </Group>
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr><Table.Th>Item</Table.Th><Table.Th ta="right">Qty</Table.Th><Table.Th ta="right">Amount</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {i.items.map((it, k) => (
                  <Table.Tr key={k}>
                    <Table.Td><Text size="sm">{it.name}</Text>{it.discountPaise > 0 && <Text size="xs" c="dimmed">less {rupees(it.discountPaise)}</Text>}</Table.Td>
                    <Table.Td ta="right" className="figure">{it.qty}</Table.Td>
                    <Table.Td ta="right" className="figure">{rupees(it.amountPaise)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Stack gap={4}>
            <Line label="Subtotal" paise={i.subtotalPaise} />
            {i.discountPaise > 0 && <Line label="Discount" paise={-i.discountPaise} />}
            {i.taxPaise > 0 && <Line label="GST" paise={i.taxPaise} />}
            {i.roundOffPaise !== 0 && <Line label="Round off" paise={i.roundOffPaise} />}
            <Divider my={4} />
            <Line label="Total" paise={i.totalPaise} strong />
            <Line label="Paid" paise={i.paidPaise} />
            {i.creditedPaise > 0 && <Line label="Credited" paise={i.creditedPaise} />}
            <Line label="Due" paise={i.duePaise} strong accent={i.duePaise > 0} />
          </Stack>
          {i.payments.length > 0 && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>Payments</Text>
              {i.payments.map((p) => (
                <Group key={p.id} justify="space-between">
                  <Text size="sm">{humanize(p.kind)} · {humanize(p.mode)}{p.reference ? ` · ${p.reference}` : ""}<Text span size="xs" c="dimmed"> {dateTime(p.receivedAt)}</Text></Text>
                  <Text size="sm" className="figure" c={p.kind === "refund" ? "red" : undefined}>{rupees(p.kind === "refund" ? -p.amountPaise : p.amountPaise)}</Text>
                </Group>
              ))}
            </Stack>
          )}
          {i.cancelReason && <Text size="sm" c="red">Cancelled: {i.cancelReason}</Text>}
          {i.status !== "cancelled" && (
            <Group justify="flex-end" gap="xs">
              {can("invoice:cancel") && (
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    let reason = "";
                    modals.openConfirmModal({
                      title: `Cancel ${i.invoiceNo}?`,
                      children: <Textarea label="Reason" description="Printed in the audit log" autosize data-autofocus onChange={(e) => (reason = e.currentTarget.value)} />,
                      labels: { confirm: "Cancel invoice", cancel: "Keep it" },
                      confirmProps: { color: "red" },
                      onConfirm: () => (reason.trim() ? cancel.mutate({ id: i.id, reason: reason.trim() }) : notifications.show({ color: "red", message: "Give a reason to cancel" })),
                    });
                  }}
                >
                  Cancel invoice
                </Button>
              )}
              {can("payment:refund") && i.paidPaise > 0 && <Button variant="default" onClick={() => setPayKind("refund")}>Refund</Button>}
              {can("payment:create") && i.duePaise > 0 && <Button onClick={() => setPayKind("payment")}>Record payment</Button>}
            </Group>
          )}
          <PaymentModal key={payKind ?? "none"} invoice={i} kind={payKind} onClose={() => setPayKind(null)} />
        </Stack>
      )}
    </Drawer>
  );
}

function Line({ label, paise, strong, accent }: { label: string; paise: number; strong?: boolean; accent?: boolean }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c={strong ? undefined : "dimmed"} fw={strong ? 500 : 400}>{label}</Text>
      <Text size="sm" className="figure" fw={strong ? 500 : 400} c={accent ? "saffron.7" : undefined}>{rupees(paise)}</Text>
    </Group>
  );
}

function PaymentModal({ invoice, kind, onClose }: { invoice: Gql.Invoice; kind: "payment" | "refund" | null; onClose: () => void }) {
  const max = (kind === "refund" ? invoice.paidPaise : invoice.duePaise) / 100;
  const form = useForm({
    initialValues: { amount: max as number | "", mode: "cash", reference: "" },
    validate: {
      amount: (v) => (v === "" || v <= 0 ? "Enter an amount" : v > max ? `At most Rs ${max.toFixed(2)}` : null),
      reference: (v, all) => (all.mode !== "cash" && !v.trim() ? "Add the UPI, card or cheque reference" : null),
    },
  });
  const pay = useAction(
    (v: { amount: number; mode: string; reference: string }) => {
      const payment = { amountPaise: toPaise(v.amount), mode: v.mode as Gql.PaymentMode, reference: v.reference.trim() || undefined };
      return kind === "refund" ? mgpl.invoices.refund(invoice.id, payment) : mgpl.invoices.recordPayment(invoice.id, payment);
    },
    { success: kind === "refund" ? "Refund recorded" : "Payment recorded", refresh: [["mgpl", "invoices"], ["mgpl", "bookings"]], onDone: onClose },
  );
  return (
    <Modal opened={!!kind} onClose={onClose} title={kind === "refund" ? "Refund" : "Record a payment"}>
      <form onSubmit={form.onSubmit((v) => pay.mutate({ ...v, amount: Number(v.amount) }))}>
        <Stack>
          <NumberInput label="Amount (Rs)" min={0} max={max} decimalScale={2} thousandSeparator="," data-autofocus {...form.getInputProps("amount")} />
          <Select label="Mode" data={MODES.map((m) => ({ value: m, label: humanize(m) }))} {...form.getInputProps("mode")} />
          <TextInput label="Reference" description="UPI ref, card slip or cheque number" {...form.getInputProps("reference")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pay.isPending} color={kind === "refund" ? "red" : undefined}>{kind === "refund" ? "Refund" : "Record payment"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
