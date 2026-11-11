"use client";
import { useState } from "react";
import { Button, Checkbox, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { dayjs, IST, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { PAYMENT_MODE_OPTIONS } from "@/lib/payments";
import { useAction, useDoctors } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";
import { TestPicker } from "./TestPicker";

/**
 * Patient → tests from the catalog (typo-tolerant, lab shorthand) → walk-in or home visit, and optionally the
 * bill with the money taken at the counter, all in one request (invoice:create; payments need payment:create).
 */
export function NewBooking({ opened, onClose, onDone, patient }: { opened: boolean; onClose: () => void; onDone: (b: Gql.Booking) => void; patient?: { id: string; name: string; uhid: string } }) {
  const { branches, workBranchId, can } = useViewer();
  const doctors = useDoctors();
  const [patientSearch, setPatientSearch] = useState("");
  const [pq] = useDebouncedValue(patientSearch.trim(), 250);
  const [picked, setPicked] = useState<Map<string, Gql.CatalogTest>>(new Map());

  const form = useForm({
    initialValues: {
      branchId: workBranchId ?? "", patientId: patient?.id ?? "", doctorId: "", tests: [] as string[], collectionType: "walk_in", scheduledAt: null as string | null, notes: "",
      bill: false, paid: "" as number | "", mode: "cash",
    },
    validate: {
      branchId: (v) => (v ? null : "Pick the branch"),
      patientId: (v) => (v ? null : "Find the patient first, or register them in Patients"),
      tests: (v) => (v.length ? null : "Add at least one test"),
      scheduledAt: (v, all) => (all.collectionType === "home" && !v ? "Pick when to visit" : null),
      paid: (v, all) => (all.bill && v !== "" && toPaise(v) > total(all.tests) ? "More than the bill" : null),
    },
  });

  const patients = useQuery({ queryKey: ["mgpl", "patients", pq], queryFn: () => mgpl.patients.search(pq, 10), enabled: pq.length >= 2 });
  const total = (codes: string[]) => codes.reduce((s, c) => s + (picked.get(c)?.pricePaise ?? 0), 0);
  const sum = total(form.values.tests);
  const canBill = can("invoice:create");
  const canTake = can("payment:create");

  const create = useAction((input: Gql.CreateBookingInput) => mgpl.bookings.create(input), {
    success: (r) => `Booking ${r.booking.bookingNo} created with ${r.samples.length} sample${r.samples.length === 1 ? "" : "s"}${r.invoice ? `, invoice ${r.invoice.invoiceNo} for ${rupees(r.invoice.totalPaise)}` : ""}`,
    refresh: [["mgpl", "bookings"], ["mgpl", "invoices"]],
    onDone: (r) => {
      form.reset();
      setPicked(new Map());
      onClose();
      onDone(r.booking);
    },
  });

  const patientOptions = [
    ...(patient ? [{ value: patient.id, label: `${patient.name} · ${patient.uhid}` }] : []),
    ...(patients.data ?? []).filter((p) => p.id !== patient?.id).map((p) => ({ value: p.id, label: `${p.name} · ${p.uhid}${p.phone ? ` · ${p.phone}` : ""}` })),
  ];

  return (
    <Modal opened={opened} onClose={onClose} title="New booking" size="lg">
      <form
        onSubmit={form.onSubmit((v) =>
          create.mutate({
            branchId: v.branchId,
            patientId: v.patientId,
            doctorId: v.doctorId || undefined,
            tests: v.tests.map((testCode) => ({ testCode })),
            collectionType: v.collectionType as Gql.CollectionType,
            scheduledAt: v.collectionType === "home" && v.scheduledAt ? dayjs.tz(v.scheduledAt, IST).toISOString() : undefined,
            notes: v.notes.trim() || undefined,
            ...(v.bill && canBill
              ? { bill: { payments: canTake && v.paid !== "" && v.paid > 0 ? [{ amountPaise: toPaise(v.paid), mode: v.mode as Gql.PaymentMode }] : [] } }
              : {}),
          }),
        )}
      >
        <Stack>
          {branches.length > 1 && <Select label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} {...form.getInputProps("branchId")} />}
          <Select
            label="Patient"
            placeholder="Name, phone or UHID"
            searchable
            data={patientOptions}
            searchValue={patientSearch}
            onSearchChange={setPatientSearch}
            filter={({ options }) => options}
            nothingFoundMessage={pq.length < 2 ? "Type two letters" : "No match. Register them in Patients"}
            data-autofocus
            {...form.getInputProps("patientId")}
          />
          <TestPicker
            value={form.values.tests}
            error={form.errors.tests}
            onChange={(codes, tests) => {
              setPicked(tests);
              form.setFieldValue("tests", codes);
            }}
          />
          <Select label="Referred by" placeholder="Self" clearable searchable data={(doctors.data ?? []).map((d) => ({ value: d.id, label: d.clinic ? `${d.name} · ${d.clinic}` : d.name }))} {...form.getInputProps("doctorId")} />
          <Stack gap={4}>
            <Text size="sm" fw={500}>Collection</Text>
            <SegmentedControl data={[{ value: "walk_in", label: "At the lab" }, { value: "home", label: "Home visit" }]} {...form.getInputProps("collectionType")} />
          </Stack>
          {form.values.collectionType === "home" && (
            <DateTimePicker label="Visit time" valueFormat="D MMM YYYY, h:mm A" minDate={new Date()} {...form.getInputProps("scheduledAt")} />
          )}
          <Textarea label="Notes" description="Fasting status, clinical notes" autosize minRows={2} {...form.getInputProps("notes")} />
          {canBill && (
            <Stack gap="xs">
              <Checkbox label="Bill now" description="Issue the invoice with the booking, at MRP" {...form.getInputProps("bill", { type: "checkbox" })} />
              {form.values.bill && canTake && (
                <Group grow align="flex-start">
                  <NumberInput label="Paid now (Rs)" placeholder="Nothing yet" min={0} max={sum / 100} decimalScale={2} {...form.getInputProps("paid")}
                    rightSectionWidth={64} rightSection={sum > 0 ? <Button size="compact-xs" variant="subtle" onClick={() => form.setFieldValue("paid", sum / 100)}>All</Button> : undefined} />
                  <Select label="Mode" data={PAYMENT_MODE_OPTIONS} allowDeselect={false} {...form.getInputProps("mode")} />
                </Group>
              )}
            </Stack>
          )}
          <Group justify="space-between">
            <Text size="sm" c="dimmed" className="figure">{form.values.tests.length ? `MRP total ${rupees(sum)}` : ""}</Text>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>{form.values.bill && canBill ? "Book and bill" : "Create booking"}</Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
