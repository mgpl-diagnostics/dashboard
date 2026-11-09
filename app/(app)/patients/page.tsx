"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Drawer, Group, Modal, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Field } from "@/components/Field";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { date, humanize, rupees } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function PatientsPage() {
  return (
    <Guard permission="patient:read">
      <Suspense>
        <Patients />
      </Suspense>
    </Guard>
  );
}

function Patients() {
  const { can } = useViewer();
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [q] = useDebouncedValue(search.trim(), 250);
  const [openId, setOpenId] = useState<string | null>(null);
  const registering = params.get("new") === "1";
  const setRegistering = (on: boolean) => router.replace(on ? "/patients?new=1" : "/patients");

  const result = useQuery({ queryKey: ["mgpl", "patients", q], queryFn: () => mgpl.patients.search(q, 50), enabled: q.length >= 2 });
  const table = useTable(result.data, { sortBy: "createdAt" });

  return (
    <Enter>
      <PageHeader
        title="Patients"
        description="Search by name, phone or UHID"
        actions={can("patient:create") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setRegistering(true)}>Register patient</Button>}
      />
      <TextInput
        data-enter
        size="md"
        placeholder="Name, phone or UHID"
        aria-label="Search patients"
        leftSection={<MagnifyingGlassIcon size={18} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        autoFocus
      />
      <div data-enter>
        {result.isError ? (
          <QueryError error={result.error} retry={() => result.refetch()} />
        ) : (
          <DataTable<Gql.Patient>
            {...tableLook}
            {...table}
            fetching={result.isFetching}
            noRecordsText={q.length < 2 ? "Type at least two letters to search" : "No patient matches. Check the spelling or register them"}
            onRowClick={({ record }) => setOpenId(record.id)}
            columns={[
              { accessor: "name", title: "Name", sortable: true, render: (p) => <Text size="sm" fw={500}>{[p.title, p.name].filter(Boolean).join(" ")}</Text> },
              { accessor: "uhid", title: "UHID", sortable: true, render: (p) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{p.uhid}</Text> },
              { accessor: "sex", title: "Sex", render: (p) => humanize(p.sex), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
              { accessor: "ageYears", title: "Age", textAlign: "right", sortable: true, render: (p) => (p.ageYears != null ? `${p.ageYears} y` : "–") },
              { accessor: "phone", title: "Phone", render: (p) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{p.phone ?? "–"}</Text>, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
              { accessor: "branch.name", title: "Branch", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})` },
              { accessor: "createdAt", title: "Registered", sortable: true, render: (p) => date(p.createdAt), visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
            ]}
          />
        )}
      </div>
      <PatientDrawer id={openId} onClose={() => setOpenId(null)} />
      <RegisterPatient opened={registering} onClose={() => setRegistering(false)} onDone={(p) => { setSearch(p.uhid); setOpenId(p.id); }} />
    </Enter>
  );
}

interface PatientHistory {
  patient: Gql.Patient & {
    bookings: { id: string; bookingNo: string; status: string; createdAt: string; tests: { name: string }[] }[];
    invoices: { id: string; invoiceNo: string; status: string; totalPaise: number; duePaise: number; createdAt: string }[];
  } | null;
}

function PatientDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useViewer();
  const q = useQuery({
    queryKey: ["mgpl", "patients", "history", id],
    enabled: !!id,
    queryFn: () =>
      mgpl.request<PatientHistory>(
        `query PatientHistory($id: ID!) { patient(id: $id) {
          id uhid title name sex dob ageYears phone email createdAt address { line1 city state pincode } branch { id code name }
          ${can("booking:read") ? "bookings(limit: 20) { id bookingNo status createdAt tests { name } }" : ""}
          ${can("invoice:read") ? "invoices(limit: 20) { id invoiceNo status totalPaise duePaise createdAt }" : ""}
        } }`,
        { id },
      ),
  });
  const p = q.data?.patient;
  return (
    <Drawer opened={!!id} onClose={onClose} title={p ? p.name : "Patient"} size="lg">
      {q.isError && <QueryError error={q.error} />}
      {p && (
        <Stack gap="lg">
          <SimpleGrid cols={2} spacing="sm">
            <Field label="UHID" value={p.uhid} mono />
            <Field label="Sex and age" value={`${humanize(p.sex)}${p.ageYears != null ? `, ${p.ageYears} y` : ""}`} />
            <Field label="Phone" value={p.phone ?? "–"} mono />
            <Field label="Email" value={p.email ?? "–"} />
            <Field label="Branch" value={p.branch?.name ?? "–"} />
            <Field label="Registered" value={date(p.createdAt)} />
          </SimpleGrid>
          {p.bookings && (
            <Stack gap="xs">
              <Title order={3}>Bookings</Title>
              {p.bookings.length === 0 ? <Text size="sm" c="dimmed">No bookings yet</Text> : (
                <Table verticalSpacing="xs">
                  <Table.Tbody>
                    {p.bookings.map((b) => (
                      <Table.Tr key={b.id}>
                        <Table.Td><Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.bookingNo}</Text><Text size="xs" c="dimmed">{date(b.createdAt)}</Text></Table.Td>
                        <Table.Td><Text size="sm" lineClamp={2}>{b.tests.map((t) => t.name).join(", ")}</Text></Table.Td>
                        <Table.Td ta="right"><StatusBadge status={b.status} /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          )}
          {p.invoices && (
            <Stack gap="xs">
              <Title order={3}>Invoices</Title>
              {p.invoices.length === 0 ? <Text size="sm" c="dimmed">No invoices yet</Text> : (
                <Table verticalSpacing="xs">
                  <Table.Tbody>
                    {p.invoices.map((i) => (
                      <Table.Tr key={i.id}>
                        <Table.Td><Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{i.invoiceNo}</Text><Text size="xs" c="dimmed">{date(i.createdAt)}</Text></Table.Td>
                        <Table.Td ta="right" className="figure"><Text size="sm">{rupees(i.totalPaise)}</Text>{i.duePaise > 0 && <Text size="xs" c="red">{rupees(i.duePaise)} due</Text>}</Table.Td>
                        <Table.Td ta="right"><StatusBadge status={i.status} /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

const patientSchema = z.object({
  branchId: z.string().min(1, "Pick the branch"),
  title: z.string().optional(),
  name: z.string().trim().min(2, "Enter the patient's full name"),
  sex: z.enum(["male", "female", "other"]),
  ageYears: z.number().int().min(0, "Age can't be negative").max(130, "Check the age").optional().or(z.literal("")),
  phone: z.string().trim().regex(/^$|^[6-9]\d{9}$/, "Use a 10-digit mobile number").optional(),
  email: z.email("Check the email").optional().or(z.literal("")),
});

function RegisterPatient({ opened, onClose, onDone }: { opened: boolean; onClose: () => void; onDone: (p: Gql.Patient) => void }) {
  const { branches, workBranchId } = useViewer();
  const form = useForm({
    initialValues: { branchId: workBranchId ?? "", title: "", name: "", sex: "female", ageYears: "" as number | "", phone: "", email: "" },
    validate: zod4Resolver(patientSchema),
  });
  const register = useAction((input: Gql.RegisterPatientInput) => mgpl.patients.register(input), {
    success: (p) => `${p.name} registered as ${p.uhid}`,
    refresh: [["mgpl", "patients"]],
    onDone: (p) => {
      form.reset();
      onClose();
      onDone(p);
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="Register a patient" size="lg">
      <form
        onSubmit={form.onSubmit((v) =>
          register.mutate({
            branchId: v.branchId, name: v.name.trim(), sex: v.sex as Gql.Sex,
            title: v.title || undefined, ageYears: v.ageYears === "" ? undefined : v.ageYears, phone: v.phone || undefined, email: v.email || undefined,
          }),
        )}
      >
        <Stack>
          {branches.length > 1 && <Select label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} {...form.getInputProps("branchId")} />}
          <Group grow align="flex-start" wrap="nowrap">
            <Select label="Title" data={["Mr", "Mrs", "Ms", "Master", "Baby", "Dr"]} clearable maw={120} {...form.getInputProps("title")} />
            <TextInput label="Full name" data-autofocus {...form.getInputProps("name")} />
          </Group>
          <Stack gap={4}>
            <Text size="sm" fw={500}>Sex</Text>
            <SegmentedControl data={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} {...form.getInputProps("sex")} />
          </Stack>
          <Group grow align="flex-start">
            <NumberInput label="Age in years" min={0} max={130} allowDecimal={false} {...form.getInputProps("ageYears")} />
            <TextInput label="Mobile" inputMode="numeric" maxLength={10} {...form.getInputProps("phone")} />
          </Group>
          <TextInput label="Email" description="Optional, for sending reports" type="email" {...form.getInputProps("email")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={register.isPending}>Register</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

