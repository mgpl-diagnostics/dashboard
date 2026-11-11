"use client";
// Edits a booking (booking:update): doctor, collection, notes, tests. The api moves samples and billing with
// the tests in one transaction; this dialog says beforehand what will happen to the bill.
import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, SegmentedControl, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import type { Gql } from "@mgpl-diagnostics/client";
import { TubeCap } from "@/components/TubeCap";
import { dayjs, IST, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction, useDoctors } from "@/lib/queries";
import { TestPicker } from "./TestPicker";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the api did to the bill, in one sentence. */
export function billingSummary(r: Gql.UpdateBookingResult): string {
  const parts: string[] = [];
  if (r.cancelledInvoices.length && r.issuedInvoices.length) parts.push(`invoice ${r.cancelledInvoices.map((i) => i.invoiceNo).join(", ")} replaced by ${r.issuedInvoices.map((i) => i.invoiceNo).join(", ")}`);
  else if (r.cancelledInvoices.length) parts.push(`invoice ${r.cancelledInvoices.map((i) => i.invoiceNo).join(", ")} cancelled`);
  else if (r.issuedInvoices.length) parts.push(`new invoice ${r.issuedInvoices.map((i) => `${i.invoiceNo} for ${rupees(i.totalPaise)}`).join(", ")}`);
  if (r.creditNotes.length) parts.push(`${plural(r.creditNotes.length, "credit note")} for ${rupees(r.creditNotes.reduce((s, n) => s + n.totalPaise, 0))}`);
  if (r.refundablePaise > 0) parts.push(`${rupees(r.refundablePaise)} can be refunded from the invoice`);
  return parts.length ? `Booking saved: ${parts.join("; ")}` : "Booking saved";
}

export function EditBooking({ booking: b, onClose }: { booking: Gql.Booking; onClose: () => void }) {
  const doctors = useDoctors();
  const [adding, setAdding] = useState<string[]>([]);
  const [added, setAdded] = useState<Map<string, Gql.CatalogTest>>(new Map());
  const locked = new Set(b.reports.filter((r) => r.status !== "draft").map((r) => r.testCode));
  const form = useForm({
    initialValues: {
      doctorId: b.doctor?.id ?? "",
      collectionType: b.sampleCollection.type as string,
      scheduledAt: b.sampleCollection.scheduledAt ? dayjs(b.sampleCollection.scheduledAt).tz(IST).format("YYYY-MM-DD HH:mm:ss") : (null as string | null),
      address: b.sampleCollection.address?.line1 ?? "",
      notes: b.notes ?? "",
      remove: [] as string[],
    },
    validate: {
      scheduledAt: (v, all) => (all.collectionType === "home" && !v ? "Pick when to visit" : null),
      remove: (v) => (v.length === b.tests.length && !adding.length ? "A booking keeps at least one test; cancel it instead" : null),
    },
  });
  const v = form.values;

  const save = useAction((input: Gql.UpdateBookingInput) => mgpl.bookings.update(b.id, input), {
    success: billingSummary,
    refresh: [["mgpl", "bookings"], ["mgpl", "invoices"], ["mgpl", "samples"], ["mgpl", "books"]],
    onDone: onClose,
  });

  const submit = form.onSubmit((x) => {
    const input: Gql.UpdateBookingInput = {};
    if ((x.doctorId || null) !== (b.doctor?.id ?? null)) input.doctorId = x.doctorId || null;
    if (x.collectionType !== b.sampleCollection.type) input.collectionType = x.collectionType as Gql.CollectionType;
    const when = x.collectionType === "home" && x.scheduledAt ? dayjs.tz(x.scheduledAt, IST).toISOString() : null;
    if ((when ?? null) !== (b.sampleCollection.scheduledAt ? dayjs(b.sampleCollection.scheduledAt).toISOString() : null)) input.scheduledAt = when;
    const line1 = x.collectionType === "home" ? x.address.trim() : "";
    if (line1 !== (b.sampleCollection.address?.line1 ?? "")) input.collectionAddress = line1 ? { ...(b.sampleCollection.address ?? {}), line1 } : null;
    if (x.notes.trim() !== (b.notes ?? "")) input.notes = x.notes.trim() || null;
    if (adding.length) input.addTests = adding.map((testCode) => ({ testCode }));
    if (x.remove.length) input.removeTestCodes = x.remove;
    if (!Object.keys(input).length) return onClose();
    save.mutate(input);
  });

  // what will happen to the bill (the api decides; this only explains it)
  const live = b.invoices.filter((i) => i.status !== "cancelled");
  const paid = live.some((i) => i.status === "paid" || i.status === "partially_paid" || i.duePaise < i.totalPaise);
  const removing = b.tests.filter((t) => v.remove.includes(t.testCode));
  const addTotal = adding.reduce((s, c) => s + (added.get(c)?.pricePaise ?? 0), 0);
  const billNote = live.length && (removing.length || adding.length)
    ? paid
      ? [removing.length && `a credit note for ${removing.map((t) => t.name).join(", ")} (the refund is a separate step on the invoice)`, adding.length && `a new invoice for the added tests (${rupees(addTotal)})`].filter(Boolean).join(", and ")
      : `invoice ${live[0]!.invoiceNo} will be cancelled and issued again with the new tests`
    : null;

  return (
    <Modal opened onClose={onClose} title={`Edit booking ${b.bookingNo}`} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Stack gap={6}>
            <Text size="sm" fw={500}>Tests</Text>
            {b.tests.map((t) => (
              <Group key={t.testCode} justify="space-between" wrap="nowrap">
                <Checkbox
                  label={<>Remove {t.name} <Text span size="xs" c="dimmed" className="figure">{rupees(t.pricePaise)}</Text></>}
                  description={locked.has(t.testCode) ? "Has results, so it stays" : undefined}
                  disabled={locked.has(t.testCode)}
                  checked={v.remove.includes(t.testCode)}
                  onChange={(e) => form.setFieldValue("remove", e.currentTarget.checked ? [...v.remove, t.testCode] : v.remove.filter((c) => c !== t.testCode))}
                />
                <TubeCap sampleType={t.sampleType} />
              </Group>
            ))}
            {form.errors.remove && <Text size="xs" c="red">{form.errors.remove}</Text>}
          </Stack>
          <TestPicker label="Add tests" value={adding} exclude={b.tests.map((t) => t.testCode)} onChange={(codes, tests) => { setAdding(codes); setAdded(tests); }} />
          <Select label="Referred by" placeholder="Self" clearable searchable data={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.clinic ? `${d.name} · ${d.clinic}` : d.name }))} {...form.getInputProps("doctorId")} />
          <Stack gap={4}>
            <Text size="sm" fw={500}>Collection</Text>
            <SegmentedControl data={[{ value: "walk_in", label: "At the lab" }, { value: "home", label: "Home visit" }]} {...form.getInputProps("collectionType")} />
          </Stack>
          {v.collectionType === "home" && (
            <Group grow align="flex-start">
              <DateTimePicker label="Visit time" valueFormat="D MMM YYYY, h:mm A" {...form.getInputProps("scheduledAt")} />
              <TextInput label="Visit address" placeholder="House, street" {...form.getInputProps("address")} />
            </Group>
          )}
          <Textarea label="Notes" autosize minRows={2} {...form.getInputProps("notes")} />
          {(removing.length > 0 || adding.length > 0) && (
            <Alert color="gray" variant="light">
              <Text size="sm">
                Samples follow the tests: new sample types get a new tube, and tubes not collected yet are dropped when no test needs them.
                {billNote ? ` On the bill: ${billNote}.` : live.length ? "" : " There's no bill yet."}
              </Text>
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
