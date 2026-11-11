"use client";
import { Badge, Button, Group, Loader, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { reports, type Report } from "@/lib/reports";

const FLAG: Record<string, { label: string; color: string }> = { L: { label: "Low", color: "navy" }, H: { label: "High", color: "red" }, A: { label: "Abnormal", color: "red" } };

export function FlagBadge({ flag }: { flag: Gql.ResultFlag | null }) {
  const f = flag && FLAG[flag];
  return f ? <Badge color={f.color} size="sm">{f.label}</Badge> : null;
}

/**
 * Result entry from catalog-kit's parameters (units, methods, ranges for the patient's sex). The api
 * fills unit, range and flag from the catalog, so only values are sent.
 *
 * Every parameter is shown. Calculated ones with a formula (indirect bilirubin, globulin, A/G ratio,
 * eGFR…) are computed by the api on save; they can still be typed to override. Calculated ones without a
 * formula (CBC indices and absolute counts: the analyzer computes them) are entered like any value.
 */
export function ResultsForm({ report, sex, onSaved, onCancel }: { report: Report; sex: Gql.Sex | undefined; onSaved: () => void; onCancel: () => void }) {
  const test = useQuery({ queryKey: ["mgpl", "catalog", "test", report.testCode, sex], queryFn: () => mgpl.catalog.test(report.testCode, sex), staleTime: 30 * 60_000 });
  if (test.isPending) return <Loader size="sm" />;
  if (!test.data) return <Text size="sm" c="dimmed">This test isn&apos;t in the catalog, so there&apos;s no form for it. Ask the admin to add it.</Text>;
  // interpretation / clinical significance / notes print under the test: shown, never entered
  const params = test.data.parameters.filter((p) => p.name && p.type !== "title" && p.type !== "image" && !p.narrative);
  const notes = test.data.parameters.filter((p) => p.narrative && p.referenceText).map((p) => p.referenceText!.trim());
  if (!params.length) return <Text size="sm" c="dimmed">This test has no parameters to enter.</Text>;
  return (
    <Stack gap="sm">
      <Entry report={report} params={params} onSaved={onSaved} onCancel={onCancel} />
      {notes.length > 0 && (
        <Stack gap={6} p="sm" bg="var(--mantine-color-default-hover)" style={{ borderRadius: 8 }}>
          <Text size="xs" fw={600} c="dimmed">Printed under the test</Text>
          {notes.map((n, k) => (
            <Text key={k} size="xs" c="dimmed" style={{ whiteSpace: "pre-line" }} lineClamp={6}>{n}</Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** The api computes it on save (a formula written with parameter names; raw "pr_123" refs never resolve). */
const autoCalc = (p: Gql.CatalogParameter) => !!p.calculated && !!p.formulaText && !/pr_\d+/.test(p.formulaText);

/** A flat form key for the i-th parameter (see Entry). */
const fieldKey = (i: number) => `r${i}`;

function Entry({ report, params, onSaved, onCancel }: { report: Report; params: Gql.CatalogParameter[]; onSaved: () => void; onCancel: () => void }) {
  const existing = new Map(report.results.map((r) => [r.parameter.toLowerCase(), r.value]));
  // Form keys are positions, never parameter names: @mantine/form reads a "." in a key as a path, so a name
  // like "S.Typhi Antigen (O)" (Widal) failed to set, the select closed empty and the result was never sent.
  const form = useForm<Record<string, string>>({
    initialValues: Object.fromEntries(params.map((p, i) => [fieldKey(i), existing.get(p.name!.toLowerCase()) ?? ""])),
  });
  const save = useAction((results: Gql.ResultInput[]) => reports.saveResults(report.id, results), {
    success: "Results saved",
    refresh: [["mgpl", "bookings"], ["mgpl", "reports"]],
    onDone: onSaved,
  });

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        save.mutate(
          params
            // a calculated value is sent only when typed here; otherwise the api recomputes it from the inputs,
            // so correcting an input never leaves an old calculated value behind
            .map((p, i) => ({ p, key: fieldKey(i) }))
            .filter(({ p, key }) => !autoCalc(p) || form.isDirty(key))
            .map(({ p, key }) => ({ parameter: p.name!, value: (v[key] ?? "").trim() }))
            .filter((r) => r.value !== ""),
        ),
      )}
    >
      <Stack gap="sm">
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Parameter</Table.Th>
                <Table.Th w={180}>Result</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th>Reference</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {params.map((p, i) => (
                <Table.Tr key={p.name}>
                  <Table.Td>
                    <Text size="sm">{p.name}</Text>
                    {p.method && <Text size="xs" c="dimmed">{p.method}</Text>}
                    {autoCalc(p) && <Text size="xs" c="dimmed">= {p.formulaText}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {p.type === "options" && p.options?.length ? (
                      <Select size="xs" aria-label={p.name!} data={p.options} clearable allowDeselect {...form.getInputProps(fieldKey(i))} />
                    ) : (
                      <TextInput
                        size="xs"
                        aria-label={p.name!}
                        inputMode={p.type === "numeric" ? "decimal" : "text"}
                        ff={p.type === "numeric" ? "monospace" : undefined}
                        placeholder={autoCalc(p) ? "Calculated on save" : undefined}
                        {...form.getInputProps(fieldKey(i))}
                      />
                    )}
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{p.unit ?? ""}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" style={{ whiteSpace: "pre-line" }}>{p.range || p.referenceText || ""}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" loading={save.isPending}>Save results</Button>
        </Group>
      </Stack>
    </form>
  );
}
