"use client";
import { useState } from "react";
import { Button, Group, Modal, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { DataTable } from "mantine-datatable";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { mgpl } from "@/lib/mgpl";
import { useAction, useDoctors } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function DoctorsPage() {
  return (
    <Guard permission="doctor:read">
      <Doctors />
    </Guard>
  );
}

function Doctors() {
  const { can } = useViewer();
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Gql.Doctor | "new" | null>(null);
  const q = useDoctors(!all);
  const table = useTable(q.data, { sortBy: "name", direction: "asc", search, searchKeys: ["name", "clinic", "phone"] });
  return (
    <Enter>
      <PageHeader title="Doctors" description="Referring doctors, picked on each booking" actions={can("doctor:manage") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setEditing("new")}>Add doctor</Button>} />
      <Group data-enter justify="space-between">
        <TextInput placeholder="Name, clinic or phone" aria-label="Filter doctors" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 280 }} />
        <Switch label="Show inactive" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
      </Group>
      <div data-enter>
        {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
          <DataTable<Gql.Doctor>
            {...tableLook}
            {...table}
            fetching={q.isPending}
            onRowClick={can("doctor:manage") ? ({ record }) => setEditing(record) : undefined}
            columns={[
              { accessor: "name", title: "Name", sortable: true, render: (d) => <><Text size="sm" fw={500}>{d.name}</Text>{d.qualification && <Text size="xs" c="dimmed">{d.qualification}</Text>}</> },
              { accessor: "clinic", title: "Clinic", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
              { accessor: "phone", title: "Phone", render: (d) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{d.phone ?? "–"}</Text> },
              { accessor: "active", title: "", textAlign: "right", render: (d) => <StatusBadge status={d.active ? "active" : "disabled"} /> },
            ]}
          />
        )}
      </div>
      {editing && <DoctorForm doctor={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Enter>
  );
}

function DoctorForm({ doctor, onClose }: { doctor: Gql.Doctor | null; onClose: () => void }) {
  const form = useForm({
    initialValues: { name: doctor?.name ?? "", qualification: doctor?.qualification ?? "", phone: doctor?.phone ?? "", clinic: doctor?.clinic ?? "", active: doctor?.active ?? true },
    validate: { name: (v) => (v.trim().length < 2 ? "Enter the doctor's name" : null), phone: (v) => (v && !/^[6-9]\d{9}$/.test(v) ? "Use a 10-digit mobile number" : null) },
  });
  const save = useAction(
    (v: Gql.DoctorInput) => (doctor ? mgpl.doctors.update(doctor.id, v) : mgpl.doctors.create(v)),
    { success: doctor ? "Doctor updated" : "Doctor added", refresh: [["mgpl", "doctors"]], onDone: onClose },
  );
  return (
    <Modal opened onClose={onClose} title={doctor ? doctor.name : "Add a doctor"}>
      <form onSubmit={form.onSubmit((v) => save.mutate({ name: v.name.trim(), qualification: v.qualification || undefined, phone: v.phone || undefined, clinic: v.clinic || undefined, active: v.active }))}>
        <Stack>
          <TextInput label="Name" data-autofocus {...form.getInputProps("name")} />
          <TextInput label="Qualification" placeholder="MBBS, MD" {...form.getInputProps("qualification")} />
          <TextInput label="Clinic or hospital" {...form.getInputProps("clinic")} />
          <TextInput label="Mobile" inputMode="numeric" maxLength={10} {...form.getInputProps("phone")} />
          {doctor && <Switch label="Active" {...form.getInputProps("active", { type: "checkbox" })} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
