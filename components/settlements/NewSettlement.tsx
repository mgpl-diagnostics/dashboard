"use client";
// Pick a partner and a month, add deductions (rent, kits supplied…), preview what finance-kit computes, then save
// it as a draft. Nothing is posted until the draft is accrued.
import { useState } from "react";
import { ActionIcon, Alert, Button, Card, Divider, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { QueryError } from "@/components/QueryError";
import { dayjs, IST, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction, usePartners } from "@/lib/queries";
import { lastMonth, monthLabel, percent } from "@/lib/settlements";

interface Deduction { label: string; amount: number | "" }

export function NewSettlement({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Gql.Settlement) => void }) {
  const partners = usePartners();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(`${lastMonth()}-01`);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const period = month ? dayjs(month).format("YYYY-MM") : null;
  const valid = deductions.filter((d) => d.label.trim() && d.amount !== "" && d.amount > 0);
  const input: Gql.SettlementDeductionInput[] = valid.map((d) => ({ label: d.label.trim(), amountPaise: toPaise(Number(d.amount)) }));
  const key = JSON.stringify(input);

  const preview = useQuery({
    queryKey: ["mgpl", "settlements", "preview", partnerId, period, key],
    queryFn: () => mgpl.settlements.preview(partnerId!, period!, input.length ? input : undefined),
    enabled: !!partnerId && !!period,
  });
  const create = useAction(() => mgpl.settlements.create(partnerId!, period!, input.length ? input : undefined), {
    success: (s) => `Draft settlement for ${monthLabel(s.period)} saved`,
    refresh: [["mgpl", "settlements"]],
    onDone: onCreated,
  });
  const p = preview.data;
  const set = (i: number, patch: Partial<Deduction>) => setDeductions((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <Modal opened onClose={onClose} title="New settlement" size="lg">
      <Stack gap="md">
        <Group grow align="flex-start">
          <Select
            label="Partner"
            placeholder={partners.isPending ? "Loading" : "Collection centre or franchise"}
            searchable
            data={(partners.data ?? []).filter((x) => x.active).map((x) => ({ value: x.id, label: `${x.name} (${x.code})` }))}
            value={partnerId}
            onChange={setPartnerId}
            nothingFoundMessage="No partner with that name. Add it under Partners"
            data-autofocus
          />
          <MonthPickerInput label="Month" value={month} onChange={setMonth} valueFormat="MMMM YYYY" maxDate={dayjs().tz(IST).format("YYYY-MM-DD")} />
        </Group>

        <Stack gap={6}>
          <Text size="sm" fw={500}>Deductions</Text>
          {deductions.map((d, i) => (
            <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
              <TextInput aria-label="What for" placeholder="Rent, kits supplied…" value={d.label} onChange={(e) => set(i, { label: e.currentTarget.value })} style={{ flex: 1 }} />
              <NumberInput aria-label="Amount (Rs)" placeholder="Rs" min={0} decimalScale={2} thousandSeparator="," value={d.amount} onChange={(v) => set(i, { amount: typeof v === "number" ? v : "" })} w={140} />
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Remove" onClick={() => setDeductions((all) => all.filter((_, j) => j !== i))}><TrashIcon size={16} /></ActionIcon>
            </Group>
          ))}
          <Button variant="subtle" size="xs" w="fit-content" leftSection={<PlusIcon size={14} />} onClick={() => setDeductions((all) => [...all, { label: "", amount: "" }])}>Add a deduction</Button>
        </Stack>

        {preview.isError && <QueryError error={preview.error} retry={() => preview.refetch()} />}
        {p && (
          <Card padding="md">
            <Stack gap={6}>
              <Row label={`${p.lines.length} ${p.lines.length === 1 ? "line" : "lines"} billed in ${monthLabel(p.period)}`} paise={p.grossPaise} />
              <Row label="Partner's share" paise={p.sharePaise} />
              {p.deductions.map((d, i) => <Row key={i} label={`Less ${d.label}`} paise={d.amountPaise} />)}
              <Row label={`Less TDS${p.tds.section ? ` u/s ${p.tds.section}` : ""} at ${percent(p.tds.rateBp)}`} paise={p.tds.tdsPaise} />
              <Divider />
              <Row label="Net payable" paise={p.netPaise} strong />
            </Stack>
          </Card>
        )}
        {p && p.uncoveredInvoices.length > 0 && (
          <Alert color="saffron" title="Some invoices have no agreement on their date">
            <Text size="sm">{p.uncoveredInvoices.join(", ")} earn no share. Add or extend an agreement first if they should.</Text>
          </Alert>
        )}
        {p && p.tds.tdsPaise === 0 && p.tds.basePaise === 0 && p.sharePaise > 0 && (
          <Text size="xs" c="dimmed">No TDS yet: the partner&apos;s shares this year are under the threshold set with the CA.</Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!p || preview.isFetching} onClick={() => create.mutate(undefined)}>Save as draft</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Row({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm" c={strong ? undefined : "dimmed"} fw={strong ? 500 : 400}>{label}</Text>
      <Text size="sm" className="figure" fw={strong ? 600 : 400} c={strong ? "saffron.7" : undefined} style={{ whiteSpace: "nowrap" }}>{rupees(paise)}</Text>
    </Group>
  );
}
