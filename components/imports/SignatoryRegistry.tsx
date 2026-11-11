"use client";
import { useState } from "react";
import { Group, SegmentedControl, Text } from "@mantine/core";
import { DataTable } from "mantine-datatable";
import type { Gql } from "@mgpl-diagnostics/client";
import { QueryError } from "@/components/QueryError";
import { date, humanize } from "@/lib/format";
import { labName } from "@/lib/imports";
import { useSignatories } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";

/** The organisation's partner signatories: names staff gave to partner signatures (data, never code). */
export function SignatoryRegistry() {
  const [lab, setLab] = useState<Gql.ExternalLab | "">("");
  const q = useSignatories(lab || undefined);
  const table = useTable(q.data, { sortBy: "name", direction: "asc" });

  return (
    <>
      <Group justify="space-between" gap="sm" mb="md">
        <SegmentedControl
          value={lab}
          onChange={(v) => setLab(v as Gql.ExternalLab | "")}
          data={[{ value: "", label: "All partners" }, { value: "hypatho", label: "Hy Patho Lab" }, { value: "clinova", label: "Clinova Pathlabs" }]}
        />
        <Text size="xs" c="dimmed">Name a new signature from the import that carries it</Text>
      </Group>
      {q.isError ? (
        <QueryError error={q.error} retry={() => q.refetch()} />
      ) : (
        <DataTable
          {...tableLook}
          {...table}
          fetching={q.isPending}
          noRecordsText="No partner signatories named yet"
          columns={[
            { accessor: "name", title: "Name", sortable: true, render: (s) => <Text size="sm" fw={500}>{s.name}</Text> },
            { accessor: "lab", title: "Partner", sortable: true, render: (s) => labName(s.lab) },
            { accessor: "qualification", title: "Qualification", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (s) => s.qualification ?? "–" },
            { accessor: "registration", title: "Registration", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (s) => <Text size="sm" ff="monospace">{s.registration ?? "–"}</Text> },
            { accessor: "role", title: "Role", render: (s) => (s.role ? humanize(s.role) : "–") },
            { accessor: "signatureCount", title: "Signatures", textAlign: "right", visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.sm})`, render: (s) => <Text size="sm" className="figure">{s.signatureCount}</Text> },
            { accessor: "createdAt", title: "Added", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.lg})`, render: (s) => date(s.createdAt) },
          ]}
        />
      )}
    </>
  );
}
