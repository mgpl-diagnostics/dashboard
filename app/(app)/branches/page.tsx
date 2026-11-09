"use client";
import { useState } from "react";
import { Button, Group, Modal, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { humanize } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function BranchesPage() {
  return (
    <Guard permission="branch:read">
      <Branches />
    </Guard>
  );
}

function Branches() {
  const { can, viewer } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "branches"], queryFn: () => mgpl.organization.branches() });
  const [editing, setEditing] = useState<Gql.Branch | "new" | null>(null);
  return (
    <Enter>
      <PageHeader title="Branches" description={`${viewer.organization.name}${viewer.organization.gstin ? ` · GSTIN ${viewer.organization.gstin}` : ""}`} actions={can("branch:create") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setEditing("new")}>Add branch</Button>} />
      <div data-enter>
        {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
          <DataTable<Gql.Branch>
            {...tableLook}
            fetching={q.isPending}
            records={q.data ?? []}
            onRowClick={can("branch:update") ? ({ record }) => setEditing(record) : undefined}
            columns={[
              { accessor: "name", title: "Branch", render: (b) => <><Text size="sm" fw={500}>{b.name}</Text><Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.code}</Text></> },
              { accessor: "kind", title: "Kind", render: (b) => humanize(b.kind) },
              { accessor: "address.city", title: "City", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})` },
              { accessor: "phone", title: "Phone", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (b) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{b.phone ?? "–"}</Text> },
              { accessor: "active", title: "", textAlign: "right", render: (b) => <StatusBadge status={b.active ? "active" : "disabled"} /> },
            ]}
          />
        )}
      </div>
      {editing && <BranchForm branch={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Enter>
  );
}

function BranchForm({ branch, onClose }: { branch: Gql.Branch | null; onClose: () => void }) {
  const form = useForm({
    initialValues: {
      code: branch?.code ?? "", name: branch?.name ?? "", kind: branch?.kind ?? "collection_center", phone: branch?.phone ?? "", gstin: branch?.gstin ?? "",
      line1: branch?.address?.line1 ?? "", city: branch?.address?.city ?? "", state: branch?.address?.state ?? "Chhattisgarh", pincode: branch?.address?.pincode ?? "", active: branch?.active ?? true,
    },
    validate: {
      code: (v) => (branch || /^[A-Z0-9-]{2,12}$/.test(v) ? null : "2 to 12 capitals, digits or -"),
      name: (v) => (v.trim() ? null : "Name the branch"),
      gstin: (v) => (!v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ? null : "Check the GSTIN"),
      pincode: (v) => (!v || /^\d{6}$/.test(v) ? null : "Six digits"),
    },
  });
  const save = useAction(
    (v: typeof form.values) => {
      const input = { name: v.name.trim(), kind: v.kind as Gql.BranchKind, phone: v.phone || undefined, gstin: v.gstin || undefined, address: { line1: v.line1 || null, city: v.city || null, state: v.state || null, pincode: v.pincode || null }, active: v.active };
      return branch ? mgpl.organization.updateBranch(branch.id, input) : mgpl.organization.createBranch({ ...input, code: v.code });
    },
    { success: "Branch saved", refresh: [["mgpl", "branches"], ["mgpl", "viewer"]], onDone: onClose },
  );
  return (
    <Modal opened onClose={onClose} title={branch ? branch.name : "Add a branch"} size="lg">
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Code" disabled={!!branch} {...form.getInputProps("code")} onChange={(e) => form.setFieldValue("code", e.currentTarget.value.toUpperCase())} />
            <TextInput label="Name" {...form.getInputProps("name")} />
          </SimpleGrid>
          <SegmentedControl data={[{ value: "lab", label: "Lab" }, { value: "collection_center", label: "Collection centre" }]} {...form.getInputProps("kind")} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Phone" {...form.getInputProps("phone")} />
            <TextInput label="GSTIN" description="Only if registered separately" {...form.getInputProps("gstin")} />
            <TextInput label="Address" {...form.getInputProps("line1")} />
            <TextInput label="City" {...form.getInputProps("city")} />
            <TextInput label="State" {...form.getInputProps("state")} />
            <TextInput label="PIN code" inputMode="numeric" maxLength={6} {...form.getInputProps("pincode")} />
          </SimpleGrid>
          {branch && <Switch label="Active" {...form.getInputProps("active", { type: "checkbox" })} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
