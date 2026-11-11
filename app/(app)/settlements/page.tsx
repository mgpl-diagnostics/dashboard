"use client";
import { useState } from "react";
import { Alert, Button, Group, SegmentedControl, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { NewSettlement } from "@/components/settlements/NewSettlement";
import { PartnerDrawer } from "@/components/settlements/PartnerDrawer";
import { SettlementDrawer } from "@/components/settlements/SettlementDrawer";
import { humanize, rupees } from "@/lib/format";
import { monthLabel } from "@/lib/settlements";
import { usePartners, useSettlements } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

type Status = Gql.SettlementStatus | "";

export default function SettlementsPage() {
  return (
    <Guard permission="accounts:read">
      <Settlements />
    </Guard>
  );
}

function Settlements() {
  const { can } = useViewer();
  const [tab, setTab] = useState<string | null>("settlements");
  const [open, setOpen] = useState<string | null>(null);
  const [partner, setPartner] = useState<string | "new" | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Enter>
      <PageHeader
        title="Settlements"
        description="Monthly shares of collection centres and franchises, with TDS"
        actions={
          tab === "partners"
            ? can("accounts:manage") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setPartner("new")}>Add partner</Button>
            : can("accounts:post") && <Button leftSection={<PlusIcon size={16} />} onClick={() => setCreating(true)}>New settlement</Button>
        }
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false} data-enter>
        <Tabs.List mb="md">
          <Tabs.Tab value="settlements">Settlements</Tabs.Tab>
          <Tabs.Tab value="partners">Partners</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="settlements"><SettlementList onOpen={setOpen} /></Tabs.Panel>
        <Tabs.Panel value="partners"><PartnerList onOpen={setPartner} /></Tabs.Panel>
      </Tabs>
      <SettlementDrawer id={open} onClose={() => setOpen(null)} />
      {partner && <PartnerDrawer id={partner === "new" ? null : partner} onClose={() => setPartner(null)} onCreated={(p) => setPartner(p.id)} />}
      {creating && <NewSettlement onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); setOpen(s.id); }} />}
    </Enter>
  );
}

function SettlementList({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<Status>("");
  const [search, setSearch] = useState("");
  const q = useSettlements(status ? { status } : {});
  const table = useTable(q.data, { sortBy: "period", direction: "desc", search, searchKeys: ["partner.name", "partner.code", "period"] });
  return (
    <>
      <Group justify="space-between" gap="sm" mb="md">
        <SegmentedControl
          value={status}
          onChange={(v) => setStatus(v as Status)}
          data={[
            { value: "draft", label: "Draft" },
            { value: "accrued", label: "To pay" },
            { value: "paid", label: "Paid" },
            { value: "cancelled", label: "Cancelled" },
            { value: "", label: "All" },
          ]}
          style={{ overflowX: "auto", maxWidth: "100%" }}
        />
        <TextInput placeholder="Partner or month" aria-label="Filter" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 240 }} />
      </Group>
      {q.isError ? (
        <QueryError error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable<Gql.Settlement>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No settlements yet"
          onRowClick={({ record }) => onOpen(record.id)}
          columns={[
            { accessor: "period", title: "Month", sortable: true, render: (s) => <Text size="sm" style={{ whiteSpace: "nowrap" }}>{monthLabel(s.period)}</Text> },
            { accessor: "partner.name", title: "Partner", sortable: true, render: (s) => <><Text size="sm" fw={500}>{s.partner.name}</Text><Text size="xs" c="dimmed" ff="monospace">{s.partner.code}</Text></> },
            { accessor: "sharePaise", title: "Share", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (s) => <Text size="sm" className="figure">{rupees(s.sharePaise)}</Text> },
            { accessor: "tdsPaise", title: "TDS", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (s) => <Text size="sm" className="figure">{rupees(s.tdsPaise)}</Text> },
            { accessor: "netPaise", title: "Net payable", textAlign: "right", sortable: true, render: (s) => <Text size="sm" className="figure" fw={500}>{rupees(s.netPaise)}</Text> },
            { accessor: "status", title: "Status", render: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      )}
    </>
  );
}

function PartnerList({ onOpen }: { onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const q = usePartners();
  const rows = (q.data ?? []).filter((p) => all || p.active);
  const table = useTable(rows, { sortBy: "name", direction: "asc", search, searchKeys: ["name", "code", "phone"] });
  return (
    <>
      <Group justify="space-between" gap="sm" mb="md">
        <TextInput placeholder="Name, code or phone" aria-label="Filter partners" leftSection={<MagnifyingGlassIcon size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={{ base: "100%", sm: 280 }} />
        <Switch label="Show inactive" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
      </Group>
      {q.isError ? (
        <QueryError error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable<Gql.Partner>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No collection centres or franchises yet"
          onRowClick={({ record }) => onOpen(record.id)}
          columns={[
            { accessor: "name", title: "Name", sortable: true, render: (p) => <><Text size="sm" fw={500}>{p.name}</Text><Text size="xs" c="dimmed" ff="monospace">{p.code}</Text></> },
            { accessor: "kind", title: "Kind", render: (p) => humanize(p.kind) },
            { accessor: "branch.name", title: "Branch", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})` },
            { accessor: "agreements", title: "Agreements", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (p) => <Text size="sm" className="figure">{p.agreements.length}</Text> },
            { accessor: "active", title: "", textAlign: "right", render: (p) => <StatusBadge status={p.active ? "active" : "disabled"} /> },
          ]}
        />
      )}
      {rows.some((p) => p.agreements.length === 0) && (
        <Alert color="saffron" variant="light" mt="md">Partners without an agreement get no share. Open them to add one.</Alert>
      )}
    </>
  );
}
