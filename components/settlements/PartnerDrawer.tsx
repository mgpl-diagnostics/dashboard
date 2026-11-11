"use client";
// A collection centre or franchise: details, TDS override and its agreements (accounts:manage edits them).
// No doctor referral commissions: partners are collection centres and franchises only (finance-kit rule 8).
import { useState } from "react";
import {
  ActionIcon, Alert, Badge, Button, Card, Drawer, Group, Loader, MultiSelect, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { QueryError } from "@/components/QueryError";
import { date, dayjs, IST, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { AGREEMENT_KINDS, ITEM_CATEGORIES, PARTNER_KINDS, percent, toBp } from "@/lib/settlements";
import { useViewer } from "@/lib/viewer";

const REFRESH = [["mgpl", "partners"], ["mgpl", "settlements"]];

export function PartnerDrawer({ id, onClose, onCreated }: { id: string | null; onClose: () => void; onCreated: (p: Gql.Partner) => void }) {
  const q = useQuery({ queryKey: ["mgpl", "partners", "one", id], queryFn: () => mgpl.settlements.partner(id!), enabled: !!id });
  const p = q.data;
  return (
    <Drawer opened onClose={onClose} size="lg" title={id ? (p ? `${p.name} (${p.code})` : "Partner") : "Add a partner"}>
      {id && q.isPending && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {!id && <PartnerForm partner={null} onSaved={onCreated} />}
      {p && (
        <Stack gap="xl">
          <PartnerForm key={p.id} partner={p} onSaved={() => undefined} />
          <Agreements partner={p} />
        </Stack>
      )}
    </Drawer>
  );
}

function PartnerForm({ partner, onSaved }: { partner: Gql.Partner | null; onSaved: (p: Gql.Partner) => void }) {
  const { can, branches, workBranchId } = useViewer();
  const edit = can("accounts:manage");
  const form = useForm({
    initialValues: {
      code: partner?.code ?? "", name: partner?.name ?? "", kind: (partner?.kind ?? "collection_centre") as string, branchId: partner?.branch.id ?? workBranchId ?? "",
      legalName: partner?.legalName ?? "", pan: partner?.pan ?? "", gstin: partner?.gstin ?? "", phone: partner?.phone ?? "", email: partner?.email ?? "",
      line1: partner?.address?.line1 ?? "", city: partner?.address?.city ?? "", pincode: partner?.address?.pincode ?? "",
      ownTds: !!partner?.tds, tdsSection: partner?.tds?.section ?? "", tdsRate: (partner?.tds ? partner.tds.rateBp / 100 : "") as number | "",
      active: partner?.active ?? true,
    },
    validate: {
      code: (v) => (!partner && !/^[A-Z0-9-]{2,20}$/.test(v.trim().toUpperCase()) ? "2 to 20 letters, digits or -" : null),
      name: (v) => (v.trim().length < 2 ? "Enter the partner's name" : null),
      branchId: (v) => (!v ? "Pick the branch it sends samples to" : null),
      pan: (v) => (v && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase()) ? "PAN looks like ABCDE1234F" : null),
      gstin: (v) => (v && !/^\d{2}[A-Z0-9]{13}$/.test(v.trim().toUpperCase()) ? "GSTIN is 15 characters" : null),
      phone: (v) => (v && !/^[6-9]\d{9}$/.test(v) ? "Use a 10-digit mobile number" : null),
      tdsSection: (v, all) => (all.ownTds && !v.trim() ? "Enter the section" : null),
      tdsRate: (v, all) => (all.ownTds && (v === "" || v < 0 || v > 30) ? "Enter a rate in %" : null),
    },
  });
  const save = useAction(
    (v: typeof form.values) => {
      const opt = (s: string) => (s.trim() ? s.trim() : undefined);
      const address = v.line1 || v.city || v.pincode ? { line1: opt(v.line1), city: opt(v.city), pincode: opt(v.pincode) } : undefined;
      const common = {
        name: v.name.trim(), kind: v.kind as Gql.PartnerKind, legalName: opt(v.legalName), pan: opt(v.pan.toUpperCase()), gstin: opt(v.gstin.toUpperCase()),
        stateCode: v.gstin.trim() ? v.gstin.trim().slice(0, 2) : undefined, phone: opt(v.phone), email: opt(v.email), address,
      };
      const tds = v.ownTds && v.tdsRate !== "" ? { section: v.tdsSection.trim(), rateBp: toBp(Number(v.tdsRate)) } : null;
      return partner
        ? mgpl.settlements.updatePartner(partner.id, { ...common, tds, active: v.active })
        : mgpl.settlements.createPartner({ ...common, code: v.code.trim().toUpperCase(), branchId: v.branchId, ...(tds ? { tds } : {}) });
    },
    { success: partner ? "Partner updated" : "Partner added. Add its agreement next", refresh: REFRESH, onDone: onSaved },
  );

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TextInput label="Code" placeholder="CC-KHAROR" disabled={!!partner} data-autofocus={!partner || undefined} {...form.getInputProps("code")} />
            <Select label="Kind" data={PARTNER_KINDS} allowDeselect={false} {...form.getInputProps("kind")} />
          </SimpleGrid>
          <TextInput label="Name" {...form.getInputProps("name")} />
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Select label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} disabled={!!partner} allowDeselect={false} {...form.getInputProps("branchId")} />
            <TextInput label="Legal name" {...form.getInputProps("legalName")} />
            <TextInput label="PAN" maxLength={10} {...form.getInputProps("pan")} />
            <TextInput label="GSTIN" maxLength={15} {...form.getInputProps("gstin")} />
            <TextInput label="Mobile" inputMode="numeric" maxLength={10} {...form.getInputProps("phone")} />
            <TextInput label="Email" type="email" {...form.getInputProps("email")} />
          </SimpleGrid>
          <TextInput label="Address" {...form.getInputProps("line1")} />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="City" {...form.getInputProps("city")} />
            <TextInput label="PIN code" inputMode="numeric" maxLength={6} {...form.getInputProps("pincode")} />
          </SimpleGrid>
          <Switch label="Own TDS section and rate (instead of the organisation's default)" {...form.getInputProps("ownTds", { type: "checkbox" })} />
          {form.values.ownTds && (
            <>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="TDS section" placeholder="194H" {...form.getInputProps("tdsSection")} />
                <NumberInput label="TDS rate (%)" min={0} max={30} decimalScale={2} {...form.getInputProps("tdsRate")} />
              </SimpleGrid>
              <Text size="xs" c="dimmed">Confirm the section and rate with the CA. Without PAN the law may need a higher rate.</Text>
            </>
          )}
          {partner && <Switch label="Active" {...form.getInputProps("active", { type: "checkbox" })} />}
          {partner && <Text size="xs" c="dimmed">Ledger: {partner.ledger.name}</Text>}
          {edit && (
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending}>{partner ? "Save changes" : "Add partner"}</Button>
            </Group>
          )}
        </Stack>
      </fieldset>
    </form>
  );
}

function Agreements({ partner }: { partner: Gql.Partner }) {
  const { can } = useViewer();
  const [adding, setAdding] = useState(false);
  const sorted = [...partner.agreements].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={3}>Agreements</Title>
        {can("accounts:manage") && !adding && <Button size="xs" variant="light" leftSection={<PlusIcon size={14} />} onClick={() => setAdding(true)}>Add agreement</Button>}
      </Group>
      {sorted.length === 0 && !adding && <Alert color="saffron" variant="light">No agreement yet, so this partner earns no share.</Alert>}
      {sorted.map((a) => (
        <Card key={a.id} padding="sm">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                {a.kind === "revenue_share" ? `${percent(a.shareBp)} of revenue` : `Fixed per test${a.defaultSharePaise != null ? `, ${rupees(a.defaultSharePaise)} by default` : ""}`}
              </Text>
              <Text size="xs" c="dimmed">From {date(a.effectiveFrom)}{a.effectiveTo ? ` to ${date(a.effectiveTo)}` : ", open-ended"}{a.categories?.length ? ` · ${a.categories.join(", ")}` : ""}</Text>
              {a.rates && a.rates.length > 0 && <Text size="xs" c="dimmed">{a.rates.map((r) => `${r.code} ${rupees(r.sharePaise)}`).join(" · ")}</Text>}
              {a.notes && <Text size="xs">{a.notes}</Text>}
            </Stack>
            {!a.effectiveTo || dayjs(a.effectiveTo).isAfter(dayjs()) ? <Badge color="tulsi" variant="light">In force</Badge> : <Badge color="gray" variant="light">Ended</Badge>}
          </Group>
        </Card>
      ))}
      {adding && <AgreementForm partner={partner} onDone={() => setAdding(false)} />}
    </Stack>
  );
}

interface Rate { code: string; amount: number | "" }

function AgreementForm({ partner, onDone }: { partner: Gql.Partner; onDone: () => void }) {
  const form = useForm({
    initialValues: {
      kind: "revenue_share" as Gql.AgreementKind, share: "" as number | "", categories: ["test", "package"] as string[], defaultShare: "" as number | "", rates: [] as Rate[],
      from: dayjs().tz(IST).startOf("month").format("YYYY-MM-DD") as string | null, to: null as string | null, notes: "",
    },
    validate: {
      share: (v, all) => (all.kind === "revenue_share" && (v === "" || v <= 0 || v > 100) ? "Enter a share between 0 and 100%" : null),
      defaultShare: (v, all) => (all.kind === "fixed_rate" && v === "" && !all.rates.some((r) => r.code.trim() && r.amount !== "") ? "Give a default amount or rates per test" : null),
      from: (v) => (!v ? "Pick the start date" : null),
      to: (v, all) => (v && all.from && v < all.from ? "Ends before it starts" : null),
    },
  });
  const save = useAction(
    (v: typeof form.values) =>
      mgpl.settlements.addAgreement({
        partnerId: partner.id, kind: v.kind, effectiveFrom: v.from!, ...(v.to ? { effectiveTo: v.to } : {}), ...(v.notes.trim() ? { notes: v.notes.trim() } : {}),
        ...(v.categories.length ? { categories: v.categories as Gql.ItemCategory[] } : {}),
        ...(v.kind === "revenue_share"
          ? { shareBp: toBp(Number(v.share)) }
          : {
              ...(v.defaultShare !== "" ? { defaultSharePaise: toPaise(Number(v.defaultShare)) } : {}),
              rates: v.rates.filter((r) => r.code.trim() && r.amount !== "").map((r) => ({ code: r.code.trim().toUpperCase(), sharePaise: toPaise(Number(r.amount)) })),
            }),
      }),
    { success: "Agreement added", refresh: REFRESH, onDone },
  );
  const rates = form.values.rates;

  return (
    <Card padding="md">
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <SegmentedControl data={AGREEMENT_KINDS} {...form.getInputProps("kind")} />
          {form.values.kind === "revenue_share" ? (
            <NumberInput label="Partner's share (%)" description="Of the net bill after discounts, before GST" min={0} max={100} decimalScale={2} data-autofocus {...form.getInputProps("share")} />
          ) : (
            <Stack gap={6}>
              <NumberInput label="Default amount per item (Rs)" description="For items without their own rate below" min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps("defaultShare")} />
              {rates.map((r, i) => (
                <Group key={i} gap="xs" wrap="nowrap">
                  <TextInput aria-label="Test code" placeholder="Test code, e.g. LIPR" value={r.code} onChange={(e) => form.setFieldValue(`rates.${i}.code`, e.currentTarget.value)} style={{ flex: 1 }} />
                  <NumberInput aria-label="Amount (Rs)" placeholder="Rs" min={0} decimalScale={2} value={r.amount} onChange={(v) => form.setFieldValue(`rates.${i}.amount`, typeof v === "number" ? v : "")} w={130} />
                  <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Remove" onClick={() => form.removeListItem("rates", i)}><TrashIcon size={16} /></ActionIcon>
                </Group>
              ))}
              <Button variant="subtle" size="xs" w="fit-content" leftSection={<PlusIcon size={14} />} onClick={() => form.insertListItem("rates", { code: "", amount: "" })}>Add a rate for one test</Button>
            </Stack>
          )}
          <MultiSelect label="Applies to" data={ITEM_CATEGORIES} clearable {...form.getInputProps("categories")} />
          <SimpleGrid cols={2} spacing="sm">
            <DateInput label="From" valueFormat="D MMM YYYY" {...form.getInputProps("from")} />
            <DateInput label="To" placeholder="Open-ended" valueFormat="D MMM YYYY" clearable {...form.getInputProps("to")} />
          </SimpleGrid>
          <Textarea label="Notes" autosize minRows={1} {...form.getInputProps("notes")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onDone}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Add agreement</Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
