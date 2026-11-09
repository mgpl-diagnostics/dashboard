"use client";
import { useState } from "react";
import { Group, Select, Text } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { dateTime } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { tableLook } from "@/lib/table";

const PAGE = 50;
const ENTITIES = ["patient", "booking", "sample", "report", "invoice", "payment", "voucher", "user", "role", "branch", "session"];

export default function AuditPage() {
  return (
    <Guard permission="audit:read">
      <Audit />
    </Guard>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["mgpl", "audit", entity, page],
    queryFn: () => mgpl.organization.auditLog({ entity: entity ?? undefined, limit: PAGE + 1, offset: (page - 1) * PAGE }),
    placeholderData: (prev) => prev,
  });
  const rows = (q.data ?? []).slice(0, PAGE);
  const more = (q.data?.length ?? 0) > PAGE;
  return (
    <Enter>
      <PageHeader title="Audit log" description="Who did what, newest first" />
      <Group data-enter>
        <Select placeholder="Everything" aria-label="Record type" clearable allowDeselect data={ENTITIES.map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))} value={entity} onChange={(v) => { setEntity(v); setPage(1); }} w={200} />
      </Group>
      <div data-enter>
        {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
          <DataTable<Gql.AuditEntry>
            {...tableLook}
            fetching={q.isFetching}
            records={rows}
            // The api pages by offset and doesn't return a total, so the pager knows only "is there more".
            totalRecords={(page - 1) * PAGE + rows.length + (more ? 1 : 0)}
            recordsPerPage={PAGE}
            page={page}
            onPageChange={setPage}
            paginationText={({ from, to }) => `${from} to ${to}${more ? ", more on the next page" : ""}`}
            columns={[
              { accessor: "at", title: "When", render: (a) => <Text size="sm" className="figure">{dateTime(a.at)}</Text> },
              { accessor: "user.name", title: "Who", render: (a) => a.user?.name ?? "System" },
              { accessor: "action", title: "What", render: (a) => <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{a.action}</Text> },
              { accessor: "entity", title: "Record", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (a) => <Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>{a.entity ? `${a.entity} ${a.entityId?.slice(-8) ?? ""}` : ""}</Text> },
            ]}
          />
        )}
      </div>
    </Enter>
  );
}
