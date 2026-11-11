"use client";
// A B2B customer: details and credit terms (accounts:manage), statement with open items and ageing, and
// credit invoices billed to it (accounts:post + invoice:create; the api checks the credit limit).
import { useMemo, useState } from "react";
import {
  Alert, Button, Card, Drawer, Group, Loader, Modal, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { ReceiptIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { date, dayjs, financialYearRange, humanize, IST, rupees, toPaise } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { AGEING, CUSTOMER_KINDS } from "@/lib/receivables";
import { useViewer } from "@/lib/viewer";

const REFRESH = [["mgpl", "customers"], ["mgpl", "invoices"], ["mgpl", "books"]];

export function CustomerDrawer({ id, onClose, onCreated }: { id: string | null; onClose: () => void; onCreated: (c: Gql.Customer) => void }) {
  const q = useQuery({ queryKey: ["mgpl", "customers", "one", id], queryFn: () => mgpl.receivables.customer(id!), enabled: !!id });
  const c = q.data;
  return (
    <Drawer opened onClose={onClose} size="xl" title={id ? (c ? `${c.name} (${c.code})` : "Customer") : "Add a B2B customer"}>
      {id && q.isPending && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {!id && <CustomerForm customer={null} onSaved={onCreated} />}
      {c && (
        <Stack gap="xl">
          <Statement customer={c} />
          <CustomerForm key={c.id} customer={c} onSaved={() => undefined} />
        </Stack>
      )}
    </Drawer>
  );
}

function CustomerForm({ customer, onSaved }: { customer: Gql.Customer | null; onSaved: (c: Gql.Customer) => void }) {
  const { can } = useViewer();
  const edit = can("accounts:manage");
  const form = useForm({
    initialValues: {
      code: customer?.code ?? "", name: customer?.name ?? "", kind: (customer?.kind ?? "hospital") as string, legalName: customer?.legalName ?? "",
      gstin: customer?.gstin ?? "", pan: customer?.pan ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "",
      line1: customer?.address?.line1 ?? "", city: customer?.address?.city ?? "", pincode: customer?.address?.pincode ?? "",
      limited: customer ? customer.creditLimitPaise != null : true, limit: (customer?.creditLimitPaise != null ? customer.creditLimitPaise / 100 : "") as number | "",
      creditDays: (customer?.creditDays ?? 30) as number | "", active: customer?.active ?? true,
    },
    validate: {
      code: (v) => (!customer && !/^[A-Z0-9-]{2,20}$/.test(v.trim().toUpperCase()) ? "2 to 20 letters, digits or -" : null),
      name: (v) => (v.trim().length < 2 ? "Enter the customer's name" : null),
      gstin: (v) => (v && !/^\d{2}[A-Z0-9]{13}$/.test(v.trim().toUpperCase()) ? "GSTIN is 15 characters" : null),
      pan: (v) => (v && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase()) ? "PAN looks like ABCDE1234F" : null),
      phone: (v) => (v && !/^[6-9]\d{9}$/.test(v) ? "Use a 10-digit mobile number" : null),
      limit: (v, all) => (all.limited && (v === "" || v < 0) ? "Enter the credit limit" : null),
      creditDays: (v) => (v === "" || v < 0 || v > 365 ? "0 to 365 days" : null),
    },
  });
  const save = useAction(
    (v: typeof form.values) => {
      const opt = (s: string) => (s.trim() ? s.trim() : undefined);
      const gstin = opt(v.gstin.toUpperCase());
      const common = {
        name: v.name.trim(), kind: v.kind as Gql.CustomerKind, legalName: opt(v.legalName), gstin, stateCode: gstin?.slice(0, 2), pan: opt(v.pan.toUpperCase()),
        phone: opt(v.phone), email: opt(v.email),
        address: v.line1 || v.city || v.pincode ? { line1: opt(v.line1), city: opt(v.city), pincode: opt(v.pincode) } : undefined,
        creditLimitPaise: v.limited && v.limit !== "" ? toPaise(Number(v.limit)) : null, creditDays: Number(v.creditDays),
      };
      return customer ? mgpl.receivables.updateCustomer(customer.id, { ...common, active: v.active }) : mgpl.receivables.createCustomer({ ...common, code: v.code.trim().toUpperCase() });
    },
    { success: customer ? "Customer updated" : "Customer added", refresh: REFRESH, onDone: onSaved },
  );
  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
        <Stack gap="sm">
          {customer && <Title order={3}>Details</Title>}
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TextInput label="Code" placeholder="CITYHOSP" disabled={!!customer} {...form.getInputProps("code")} />
            <Select label="Kind" data={CUSTOMER_KINDS} allowDeselect={false} {...form.getInputProps("kind")} />
          </SimpleGrid>
          <TextInput label="Name" {...form.getInputProps("name")} />
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TextInput label="Legal name" {...form.getInputProps("legalName")} />
            <TextInput label="GSTIN" description="Its state decides CGST + SGST or IGST" maxLength={15} {...form.getInputProps("gstin")} />
            <TextInput label="PAN" maxLength={10} {...form.getInputProps("pan")} />
            <TextInput label="Mobile" inputMode="numeric" maxLength={10} {...form.getInputProps("phone")} />
            <TextInput label="Email" type="email" {...form.getInputProps("email")} />
            <TextInput label="Address" {...form.getInputProps("line1")} />
            <TextInput label="City" {...form.getInputProps("city")} />
            <TextInput label="PIN code" inputMode="numeric" maxLength={6} {...form.getInputProps("pincode")} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Stack gap={6}>
              <Switch label="Credit limit" {...form.getInputProps("limited", { type: "checkbox" })} />
              {form.values.limited && <NumberInput aria-label="Credit limit (Rs)" placeholder="Rs" min={0} thousandSeparator="," decimalScale={2} {...form.getInputProps("limit")} />}
            </Stack>
            <NumberInput label="Credit days" description="Invoices fall due after this" min={0} max={365} {...form.getInputProps("creditDays")} />
          </SimpleGrid>
          {customer && <Switch label="Active" {...form.getInputProps("active", { type: "checkbox" })} />}
          {edit && (
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending}>{customer ? "Save changes" : "Add customer"}</Button>
            </Group>
          )}
        </Stack>
      </fieldset>
    </form>
  );
}

function Statement({ customer }: { customer: Gql.Customer }) {
  const { can } = useViewer();
  const fy = financialYearRange();
  const [range, setRange] = useState<[string | null, string | null]>([dayjs(fy.from).tz(IST).format("YYYY-MM-DD"), dayjs().tz(IST).format("YYYY-MM-DD")]);
  const [billing, setBilling] = useState(false);
  const from = range[0] ? dayjs.tz(range[0], IST).startOf("day").toISOString() : fy.from;
  const to = range[1] ? dayjs.tz(range[1], IST).endOf("day").toISOString() : fy.to;
  const q = useQuery({ queryKey: ["mgpl", "customers", "statement", customer.id, from, to], queryFn: () => mgpl.receivables.statement(customer.id, { from, to }) });
  const s = q.data;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <DatePickerInput type="range" label="Statement period" value={range} onChange={(v) => setRange(v as [string | null, string | null])} valueFormat="D MMM YYYY" w={260} allowSingleDateInRange />
        {can("accounts:post") && can("invoice:create") && customer.active && (
          <Button leftSection={<ReceiptIcon size={16} />} onClick={() => setBilling(true)}>Bill on credit</Button>
        )}
      </Group>
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {q.isPending && <Loader size="sm" />}
      {s && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Field label="Opening" value={rupees(s.openingPaise)} />
            <Field label="Billed" value={rupees(s.totalDebitPaise)} />
            <Field label="Received and credited" value={rupees(s.totalCreditPaise)} />
            <Field label="Closing" value={<Text fw={600} size="sm" className="figure">{rupees(s.closingPaise)}</Text>} />
          </SimpleGrid>
          {s.availableCreditPaise != null && (
            <Alert color={s.availableCreditPaise <= 0 ? "red" : "gray"} variant="light">
              {s.availableCreditPaise <= 0 ? "Credit limit reached: new credit invoices are refused until payments come in." : `${rupees(s.availableCreditPaise)} of credit left.`}
            </Alert>
          )}
          <Card padding="sm">
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
              {AGEING.map((b) => <Field key={b.key} label={b.label} value={<Text size="sm" className="figure" c={b.key === "d90plus" && s.ageing[b.key] > 0 ? "red" : undefined}>{rupees(s.ageing[b.key])}</Text>} />)}
            </SimpleGrid>
          </Card>
          {s.open.length > 0 && (
            <Stack gap="xs">
              <Title order={3}>Open invoices</Title>
              <Table.ScrollContainer minWidth={480}>
                <Table verticalSpacing={4}>
                  <Table.Thead><Table.Tr><Table.Th>Invoice</Table.Th><Table.Th>Due</Table.Th><Table.Th ta="right">Total</Table.Th><Table.Th ta="right">Outstanding</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {s.open.map((o) => (
                      <Table.Tr key={o.invoiceId}>
                        <Table.Td><Text size="sm" ff="monospace">{o.invoiceNo}</Text><Text size="xs" c="dimmed">{date(o.day)}</Text></Table.Td>
                        <Table.Td><Text size="sm">{date(o.dueDay)}</Text>{o.overdueDays > 0 && <Text size="xs" c="red">{o.overdueDays} days overdue</Text>}</Table.Td>
                        <Table.Td ta="right"><Text size="sm" className="figure">{rupees(o.totalPaise)}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" className="figure" fw={500}>{rupees(o.duePaise)}</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          )}
          <Stack gap="xs">
            <Title order={3}>Ledger</Title>
            {s.rows.length === 0 ? <Text size="sm" c="dimmed">No entries in this period.</Text> : (
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing={4}>
                  <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Voucher</Table.Th><Table.Th ta="right">Debit</Table.Th><Table.Th ta="right">Credit</Table.Th><Table.Th ta="right">Balance</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {s.rows.map((r, i) => (
                      <Table.Tr key={`${r.voucherNo}-${i}`}>
                        <Table.Td><Text size="sm" style={{ whiteSpace: "nowrap" }}>{date(r.date)}</Text></Table.Td>
                        <Table.Td><Text size="sm" ff="monospace">{r.voucherNo}</Text><Text size="xs" c="dimmed">{humanize(r.voucherType)}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" className="figure">{r.debitPaise ? rupees(r.debitPaise) : ""}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" className="figure">{r.creditPaise ? rupees(r.creditPaise) : ""}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" className="figure">{rupees(r.balancePaise)}</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </>
      )}
      {billing && <CreditInvoice customer={customer} onClose={() => setBilling(false)} />}
    </Stack>
  );
}

/** A credit invoice: the patient's tests billed to the customer, posted to its ledger. */
function CreditInvoice({ customer, onClose }: { customer: Gql.Customer; onClose: () => void }) {
  const { branches, workBranchId } = useViewer();
  const [patientSearch, setPatientSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [pq] = useDebouncedValue(patientSearch.trim(), 250);
  const [tq] = useDebouncedValue(testSearch.trim(), 200);
  const [picked, setPicked] = useState<Map<string, Gql.CatalogTest>>(new Map());
  const form = useForm({
    initialValues: { branchId: workBranchId ?? "", patientId: "", codes: [] as string[], discount: "" as number | "" },
    validate: {
      branchId: (v) => (v ? null : "Pick the branch"),
      patientId: (v) => (v ? null : "Find the patient"),
      codes: (v) => (v.length ? null : "Add at least one test"),
    },
  });
  const patients = useQuery({ queryKey: ["mgpl", "patients", pq], queryFn: () => mgpl.patients.search(pq, 10), enabled: pq.length >= 2 });
  const hits = useQuery({ queryKey: ["mgpl", "catalog", "search", tq], queryFn: () => mgpl.catalog.search(tq, { limit: 15 }), enabled: tq.length >= 2, staleTime: 10 * 60_000 });
  const testOptions = useMemo(() => {
    const m = new Map(picked);
    for (const h of hits.data ?? []) if (h.test.code) m.set(h.test.code, h.test);
    return [...m.values()].filter((t) => t.code).map((t) => ({ value: t.code!, label: `${t.name}${t.mrp != null ? ` · Rs ${t.mrp}` : ""}` }));
  }, [hits.data, picked]);
  const total = form.values.codes.reduce((s, c) => s + (picked.get(c)?.pricePaise ?? 0), 0);
  const issue = useAction(
    (v: typeof form.values) =>
      mgpl.receivables.issueInvoice({
        customerId: customer.id, branchId: v.branchId, patientId: v.patientId,
        items: v.codes.map((code) => ({ code, category: "test" as const })),
        ...(v.discount !== "" && v.discount > 0 ? { billDiscountPaise: toPaise(Number(v.discount)) } : {}),
      }),
    { success: (i) => `Invoice ${i.invoiceNo} billed to ${customer.name} for ${rupees(i.totalPaise)}`, refresh: REFRESH, onDone: onClose },
  );

  return (
    <Modal opened onClose={onClose} title={`Bill ${customer.name} on credit`} size="lg">
      <form onSubmit={form.onSubmit((v) => issue.mutate(v))}>
        <Stack>
          {branches.length > 1 && <Select label="Branch" data={branches.map((b) => ({ value: b.id, label: b.name }))} {...form.getInputProps("branchId")} />}
          <Select
            label="Patient"
            placeholder="Name, phone or UHID"
            searchable
            data={(patients.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${p.uhid}${p.phone ? ` · ${p.phone}` : ""}` }))}
            searchValue={patientSearch}
            onSearchChange={setPatientSearch}
            filter={({ options }) => options}
            nothingFoundMessage={pq.length < 2 ? "Type two letters" : "No match. Register them in Patients"}
            data-autofocus
            {...form.getInputProps("patientId")}
          />
          <MultiSelect
            label="Tests"
            placeholder="CBC, LFT, thyroid…"
            searchable
            data={testOptions}
            searchValue={testSearch}
            onSearchChange={setTestSearch}
            filter={({ options }) => options}
            nothingFoundMessage={tq.length < 2 ? "Type two letters" : "No test matches"}
            hidePickedOptions
            {...form.getInputProps("codes")}
            onChange={(codes) => {
              const all = new Map([...picked, ...(hits.data ?? []).filter((h) => h.test.code).map((h) => [h.test.code!, h.test] as const)]);
              setPicked(new Map(codes.filter((c) => all.get(c)).map((c) => [c, all.get(c)!])));
              form.setFieldValue("codes", codes);
              setTestSearch("");
            }}
          />
          <NumberInput label="Bill discount (Rs)" description="Agreed rate for this customer, if any" min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps("discount")} />
          <Group justify="space-between">
            <Text size="sm" c="dimmed" className="figure">{form.values.codes.length ? `MRP total ${rupees(total)}` : ""}</Text>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={issue.isPending}>Issue invoice</Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
