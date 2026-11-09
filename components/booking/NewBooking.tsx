"use client";
import { useMemo, useState } from "react";
import { Button, Group, Modal, MultiSelect, SegmentedControl, Select, Stack, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { dayjs, IST, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction, useDoctors } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

/** Patient → tests from the catalog (typo-tolerant, lab shorthand) → walk-in or home visit. */
export function NewBooking({ opened, onClose, onDone, patient }: { opened: boolean; onClose: () => void; onDone: (b: Gql.Booking) => void; patient?: { id: string; name: string; uhid: string } }) {
  const { branches, workBranchId } = useViewer();
  const doctors = useDoctors();
  const [patientSearch, setPatientSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [pq] = useDebouncedValue(patientSearch.trim(), 250);
  const [tq] = useDebouncedValue(testSearch.trim(), 200);
  const [picked, setPicked] = useState<Map<string, Gql.CatalogTest>>(new Map());

  const form = useForm({
    initialValues: { branchId: workBranchId ?? "", patientId: patient?.id ?? "", doctorId: "", tests: [] as string[], collectionType: "walk_in", scheduledAt: null as string | null, notes: "" },
    validate: {
      branchId: (v) => (v ? null : "Pick the branch"),
      patientId: (v) => (v ? null : "Find the patient first, or register them in Patients"),
      tests: (v) => (v.length ? null : "Add at least one test"),
      scheduledAt: (v, all) => (all.collectionType === "home" && !v ? "Pick when to visit" : null),
    },
  });

  const patients = useQuery({ queryKey: ["mgpl", "patients", pq], queryFn: () => mgpl.patients.search(pq, 10), enabled: pq.length >= 2 });
  const hits = useQuery({ queryKey: ["mgpl", "catalog", "search", tq], queryFn: () => mgpl.catalog.search(tq, { limit: 15 }), enabled: tq.length >= 2, staleTime: 10 * 60_000 });

  const testOptions = useMemo(() => {
    const m = new Map(picked);
    for (const h of hits.data ?? []) if (h.test.code) m.set(h.test.code, h.test);
    return [...m.values()].filter((t) => t.code).map((t) => ({ value: t.code!, label: `${t.name}${t.mrp != null ? ` · Rs ${t.mrp}` : ""}` }));
  }, [hits.data, picked]);

  const total = form.values.tests.reduce((s, c) => s + (picked.get(c)?.pricePaise ?? 0), 0);

  const create = useAction((input: Gql.CreateBookingInput) => mgpl.bookings.create(input), {
    success: (r) => `Booking ${r.booking.bookingNo} created with ${r.samples.length} sample${r.samples.length === 1 ? "" : "s"}`,
    refresh: [["mgpl", "bookings"]],
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
          <MultiSelect
            label="Tests"
            placeholder="CBC, LFT, vit d, thyroid…"
            searchable
            data={testOptions}
            searchValue={testSearch}
            onSearchChange={setTestSearch}
            filter={({ options }) => options}
            nothingFoundMessage={tq.length < 2 ? "Type two letters" : "No test matches"}
            hidePickedOptions
            {...form.getInputProps("tests")}
            onChange={(codes) => {
              const m = new Map<string, Gql.CatalogTest>();
              const all = new Map([...picked, ...(hits.data ?? []).filter((h) => h.test.code).map((h) => [h.test.code!, h.test] as const)]);
              for (const c of codes) if (all.get(c)) m.set(c, all.get(c)!);
              setPicked(m);
              form.setFieldValue("tests", codes);
              setTestSearch("");
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
          <Group justify="space-between">
            <Text size="sm" c="dimmed" className="figure">{form.values.tests.length ? `MRP total ${rupees(total)}` : ""}</Text>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create booking</Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
