"use client";
// One partner-lab import (api docs/18-imports.md): what the reader found in the PDF, the booking it belongs
// to, which of our tests each partner test fills, and the partner's signatories. Applying writes the results
// as entered (our staff still verify and release). The NABL line is the partner's, only under tests the
// partner marked accredited, and always text: no logo is ever drawn here.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert, Badge, Button, Card, Checkbox, Drawer, Group, Image, Loader, Modal, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, SignatureIcon, WarningIcon } from "@phosphor-icons/react";
import { signatureDataUri, type Gql } from "@mgpl-diagnostics/client";
import { Field } from "@/components/Field";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { FlagBadge } from "@/components/report/ResultsForm";
import { dateTime, humanize } from "@/lib/format";
import { fileSize, SIGNATORY_ROLES } from "@/lib/imports";
import { mgpl } from "@/lib/mgpl";
import { useAction, useBooking, useBookings, useImport } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

const REFRESH = [["mgpl", "imports"], ["mgpl", "bookings"], ["mgpl", "reports"]];

export function ImportDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useImport(id);
  const ext = q.data;
  return (
    <Drawer opened={!!id} onClose={onClose} size="xl" title={ext ? `${ext.labName} · ${ext.patient.name ?? "patient not read"}` : "Partner import"}>
      {q.isPending && id && <Loader size="sm" />}
      {q.isError && <QueryError error={q.error} retry={() => q.refetch()} />}
      {q.isSuccess && !ext && <Alert color="gray">This import doesn&apos;t exist, or it belongs to a branch you don&apos;t work in.</Alert>}
      {ext && <ImportBody key={ext.id} ext={ext} />}
    </Drawer>
  );
}

function ImportBody({ ext }: { ext: Gql.ExternalReport }) {
  const { can } = useViewer();
  const open = ext.status === "extracted" || ext.status === "matched";
  const booking = useBooking(ext.booking?.id ?? null);
  const p = ext.patient;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <Field label="Patient on the PDF" value={[p.title, p.name].filter(Boolean).join(" ") || "Not read"} />
        <Field label="Status" value={<StatusBadge status={ext.status} />} />
        <Field label="Age and sex" value={[p.ageText ?? (p.ageYears != null ? `${p.ageYears} y` : null), p.sex ? humanize(p.sex) : null].filter(Boolean).join(", ") || "Not read"} />
        <Field label="Partner patient id" value={p.patientId ?? "–"} mono />
        <Field label="Sample ids" value={ext.sampleIds.join(", ") || "–"} mono />
        <Field label="Reported by the partner" value={ext.reportedAt ?? "–"} />
        <Field label="File" value={`${ext.fileName ?? "partner.pdf"} · ${fileSize(ext.byteLength)}`} />
        <Field label="Uploaded" value={`${dateTime(ext.uploadedAt)}${ext.uploadedBy ? ` by ${ext.uploadedBy.name}` : ""}`} />
      </SimpleGrid>

      {ext.warnings.length > 0 && (
        <Alert color="saffron" icon={<WarningIcon size={18} />} title="The reader wasn't sure about some of this">
          <Stack gap={2}>{ext.warnings.map((w) => <Text key={w} size="sm">{w}</Text>)}</Stack>
          <Text size="sm" mt={6}>Check these values against the PDF before applying.</Text>
        </Alert>
      )}

      {ext.status === "rejected" && <Alert color="red" title="Rejected">{ext.rejectReason ?? "No reason given"}</Alert>}

      {ext.status === "applied" && (
        <Alert color="tulsi" icon={<CheckCircleIcon size={18} />} title={`Applied ${dateTime(ext.appliedAt)}`}>
          <Text size="sm">The results are entered on our reports. Verify and release them as usual.</Text>
          <Group gap="xs" mt="xs">
            {ext.reports.map((r) => <Badge key={r.id} color="gray" variant="light" rightSection={<StatusBadge status={r.status} />}>{r.testName}</Badge>)}
          </Group>
          {ext.booking && can("report:read") && (
            <Button component={Link} href={`/reports?booking=${ext.booking.id}`} size="xs" variant="light" mt="sm">Open the booking&apos;s reports</Button>
          )}
        </Alert>
      )}

      {open && <MatchBooking ext={ext} />}

      {ext.booking && ext.patientMismatches.length > 0 && open && (
        <Alert color="red" icon={<WarningIcon size={18} />} title={`The PDF's patient differs from booking ${ext.booking.bookingNo}`}>
          <Stack gap={2}>{ext.patientMismatches.map((m) => <Text key={m} size="sm">{m}</Text>)}</Stack>
        </Alert>
      )}

      {open && ext.status === "matched" && booking.data ? (
        <ApplyTests key={booking.data.id} ext={ext} booking={booking.data} />
      ) : (
        <Stack gap="sm">
          <Title order={3}>Tests on the PDF</Title>
          {ext.tests.map((t) => <PartnerTest key={t.index} test={t} />)}
        </Stack>
      )}

      <Signatories ext={ext} />

      {open && <RejectImport ext={ext} />}
    </Stack>
  );
}

/** Picks the booking this PDF belongs to; the api compares name, sex and age (±1 year). */
function MatchBooking({ ext }: { ext: Gql.ExternalReport }) {
  const bookings = useBookings({ limit: 200 });
  // the api's suggestions (name, sex, age, booked tests); an older api without them shows the picker only
  const candidates = useQuery({ queryKey: ["mgpl", "imports", "candidates", ext.id, ext.booking?.id ?? null], queryFn: () => mgpl.imports.candidates(ext.id), retry: false });
  const [picked, setPicked] = useState<string | null>(ext.booking?.id ?? null);
  const match = useAction((bookingId: string) => mgpl.imports.match(ext.id, bookingId), {
    refresh: REFRESH,
    success: (r) => (r.patientMismatches.length ? "Matched. The patient details differ, check them below" : `Matched to ${r.booking?.bookingNo}`),
  });
  // Bookings whose patient carries the name on the PDF come first.
  const data = useMemo(() => {
    const name = (ext.patient.name ?? "").toLowerCase();
    const list = (bookings.data ?? []).filter((b) => b.status !== "cancelled");
    const near = (b: Gql.Booking) => (name && b.patient.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && name.includes(w)) ? 0 : 1);
    return [...list].sort((a, b) => near(a) - near(b)).map((b) => ({ value: b.id, label: `${b.bookingNo} · ${b.patient.name} · ${b.tests.map((t) => t.testCode).join(", ")}` }));
  }, [bookings.data, ext.patient.name]);

  const found = (candidates.data ?? []).filter((c) => c.score > 0);
  return (
    <Card padding="md">
      <Title order={3} mb="xs">{ext.booking ? "Matched booking" : "Which booking is this?"}</Title>
      {found.length > 0 && (
        <Stack gap="xs" mb="sm">
          <Text size="sm" c="dimmed">{ext.booking ? "Other bookings it could belong to" : "Bookings it fits, best first"}</Text>
          {found.map((c) => {
            const current = c.booking.id === ext.booking?.id;
            return (
              <Group key={c.booking.id} justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="wrap">
                    <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>{c.booking.bookingNo}</Text>
                    <Text size="sm" fw={500}>{c.booking.patient.name}</Text>
                    {c.strong && <Badge size="sm" color="tulsi" variant="light">Fits</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed">{[c.booking.tests.map((t) => t.testCode).join(", "), ...c.reasons].join(" · ")}</Text>
                  {c.patientMismatches.map((m) => <Text key={m} size="xs" c="orange">{m}</Text>)}
                </Stack>
                <Button size="compact-sm" variant={c.strong && !current ? "filled" : "light"} disabled={current} loading={match.isPending && match.variables === c.booking.id} onClick={() => match.mutate(c.booking.id)}>
                  {current ? "Matched" : "Match"}
                </Button>
              </Group>
            );
          })}
        </Stack>
      )}
      <Group align="flex-end" gap="xs" wrap="wrap">
        <Select
          label={found.length ? "Or pick another booking" : "Booking"}
          placeholder={bookings.isPending ? "Loading bookings" : "Booking no or patient"}
          searchable
          data={data}
          value={picked}
          onChange={setPicked}
          nothingFoundMessage="No booking with that number or name"
          style={{ flex: 1, minWidth: 240 }}
        />
        <Button loading={match.isPending} disabled={!picked || picked === ext.booking?.id} onClick={() => picked && match.mutate(picked)}>
          {ext.booking ? "Change booking" : "Match"}
        </Button>
      </Group>
    </Card>
  );
}

interface Mapping { include: boolean; testCode: string | null }

/** One choice per partner test: which test of the booking it fills, or skip it. */
function ApplyTests({ ext, booking }: { ext: Gql.ExternalReport; booking: Gql.Booking }) {
  const { can } = useViewer();
  // A booking test can take imported results while its report is not started, a draft or entered.
  const taken = useMemo(() => new Set(booking.reports.filter((r) => r.status !== "draft" && r.status !== "entered").map((r) => r.testCode)), [booking.reports]);
  const choices = booking.tests.map((t) => ({ value: t.testCode, label: `${t.name} (${t.testCode})`, disabled: taken.has(t.testCode) }));
  const initial = (): Record<number, Mapping> => {
    const used = new Set<string>();
    return Object.fromEntries(
      ext.tests.map((t) => {
        const code = t.suggestedTestCode && booking.tests.some((b) => b.testCode === t.suggestedTestCode) && !taken.has(t.suggestedTestCode) && !used.has(t.suggestedTestCode) ? t.suggestedTestCode : null;
        if (code) used.add(code);
        return [t.index, { include: !!code, testCode: code }];
      }),
    );
  };
  const [map, setMap] = useState<Record<number, Mapping>>(initial);
  const [confirmed, setConfirmed] = useState(false);

  const chosen = ext.tests.filter((t) => map[t.index]?.include);
  const codes = chosen.map((t) => map[t.index]?.testCode);
  const twice = codes.filter((c, i) => c && codes.indexOf(c) !== i);
  const missing = chosen.some((t) => !map[t.index]?.testCode);
  const mismatch = ext.patientMismatches.length > 0;
  const ready = chosen.length > 0 && !missing && twice.length === 0 && (!mismatch || confirmed);

  const apply = useAction(
    () => mgpl.imports.apply(ext.id, ext.tests.map((t) => ({ testIndex: t.index, testCode: map[t.index]?.testCode ?? "", include: !!map[t.index]?.include && !!map[t.index]?.testCode })).filter((m) => m.include), { confirmPatientMismatch: mismatch && confirmed }),
    { refresh: REFRESH, success: (rs) => `${rs.length} ${rs.length === 1 ? "report" : "reports"} entered from ${ext.labName}. Verify them as usual` },
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <Title order={3}>Apply to booking {booking.bookingNo}</Title>
        <Text size="xs" c="dimmed">Values, units and ranges are copied as printed</Text>
      </Group>
      {ext.tests.map((t) => {
        const m = map[t.index] ?? { include: false, testCode: null };
        const set = (patch: Partial<Mapping>) => setMap((all) => ({ ...all, [t.index]: { ...m, ...patch } }));
        return (
          <PartnerTest key={t.index} test={t}>
            <Group gap="sm" align="flex-end" wrap="wrap" mt="sm">
              <Checkbox label="Apply this test" checked={m.include} onChange={(e) => set({ include: e.currentTarget.checked })} />
              <Select
                aria-label={`Our test for ${t.name}`}
                placeholder="Our test in the booking"
                data={choices}
                value={m.testCode}
                onChange={(v) => set({ testCode: v, include: !!v || m.include })}
                disabled={!m.include}
                error={m.include && !m.testCode ? "Choose our test" : m.testCode && twice.includes(m.testCode) ? "Chosen for another test too" : undefined}
                style={{ flex: 1, minWidth: 220 }}
              />
            </Group>
            {t.suggestedTestCode && !booking.tests.some((b) => b.testCode === t.suggestedTestCode) && (
              <Text size="xs" c="dimmed" mt={4}>Looks like {t.suggestedTestCode}, which isn&apos;t in this booking.</Text>
            )}
          </PartnerTest>
        );
      })}
      {choices.length > 0 && choices.every((c) => c.disabled) && <Alert color="gray">Every test in this booking is verified or released already.</Alert>}
      {mismatch && (
        <Checkbox
          color="red"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.currentTarget.checked)}
          label="I checked the patient: the PDF and the booking are the same person despite the differences above"
        />
      )}
      {can("report:enter") ? (
        <Group justify="flex-end">
          <Button
            loading={apply.isPending}
            disabled={!ready}
            onClick={() =>
              modals.openConfirmModal({
                title: `Apply ${chosen.length} ${chosen.length === 1 ? "test" : "tests"} to ${booking.bookingNo}?`,
                children: (
                  <Text size="sm">
                    The results are entered on {booking.patient.name}&apos;s reports with &quot;Performed at {ext.labName}&quot;. They are not verified or released: a pathologist still checks them. This can&apos;t be applied twice.
                  </Text>
                ),
                labels: { confirm: "Apply", cancel: "Not yet" },
                onConfirm: () => apply.mutate(undefined),
              })
            }
          >
            Apply results
          </Button>
        </Group>
      ) : (
        <Alert color="gray">Entering results needs the report:enter permission. Someone who enters results can apply this import.</Alert>
      )}
    </Stack>
  );
}

/** A partner test as printed, with the line it will print under our report. */
function PartnerTest({ test, children }: { test: Gql.ExternalTest; children?: React.ReactNode }) {
  return (
    <Card padding="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start" mb="xs">
        <Stack gap={2} miw={0}>
          <Title order={4} lineClamp={2}>{test.name}</Title>
          <Text size="xs" c="dimmed">
            {[test.department, test.sampleType, test.sampleId && `sample ${test.sampleId}`, test.method, test.reported && `reported ${test.reported}`].filter(Boolean).join(" · ") || "No details printed"}
          </Text>
        </Stack>
        {/* The partner's own accreditation, as text; never a logo. */}
        {test.accredited === true && <Badge color="gray" variant="outline" style={{ flexShrink: 0 }}>Partner NABL accredited</Badge>}
      </Group>
      {test.parameters.length > 0 ? (
        <Table.ScrollContainer minWidth={460}>
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {test.parameters.map((v, i) => (
                <Table.Tr key={`${v.name}-${i}`}>
                  <Table.Td><Text size="sm">{v.name}</Text>{v.group && <Text size="xs" c="dimmed">{v.group}</Text>}</Table.Td>
                  <Table.Td><Group gap={6} wrap="nowrap"><Text size="sm" ff="monospace" fw={v.flag && v.flag !== "NONE" ? 600 : 400}>{v.value}</Text><Text size="xs" c="dimmed">{v.unit ?? ""}</Text></Group></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" style={{ whiteSpace: "pre-line" }}>{v.range ?? ""}</Text></Table.Td>
                  <Table.Td ta="right"><FlagBadge flag={v.flag} /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Text size="sm" c="dimmed">No results read for this test.</Text>
      )}
      {test.notes && <Text size="xs" c="dimmed" mt="xs" style={{ whiteSpace: "pre-line" }}>{test.notes}</Text>}
      <Text size="xs" mt="xs"><Text span c="dimmed" size="xs">Prints under our report: </Text>{test.provenance.text}</Text>
      {children}
    </Card>
  );
}

/** Who signed the PDF. Signature images come only from this import's own PDF (the api looks them up by its sha256). */
function Signatories({ ext }: { ext: Gql.ExternalReport }) {
  const { can } = useViewer();
  const images = useQuery({ queryKey: ["mgpl", "imports", "signatures", ext.id, ext.sourceSha256], queryFn: () => mgpl.imports.signatures(ext.id), enabled: ext.signatories.length > 0 });
  const [naming, setNaming] = useState<Gql.ExternalSignatoryOnReport | null>(null);
  if (!ext.signatories.length) return null;

  return (
    <Stack gap="sm">
      <Title order={3}>Signed by</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {ext.signatories.map((s) => {
          const img = images.data?.find((i) => i.id === s.id)?.image;
          return (
            <Card key={s.id} padding="sm">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <div style={{ width: 96, height: 48, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--mantine-color-white)", borderRadius: 4 }}>
                  {img ? <Image src={signatureDataUri(img)} alt={`Signature of ${s.name ?? "an unnamed signatory"}`} fit="contain" h={44} w={92} /> : <SignatureIcon size={24} color="var(--mantine-color-gray-5)" />}
                </div>
                <Stack gap={2} miw={0} style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>{s.name ?? "Not named yet"}</Text>
                  <Text size="xs" c="dimmed">{[s.qualification, s.registration, s.title].filter(Boolean).join(" · ") || humanize(s.role)}</Text>
                  <Group gap={4}>
                    <Badge size="xs" color={s.medical ? "navy" : "gray"} variant="light">{s.medical ? "Reported by" : "Not listed (not medical)"}</Badge>
                    {s.pages.length > 0 && <Text size="xs" c="dimmed">page {s.pages.join(", ")}</Text>}
                  </Group>
                  {(s.source === "unknown" || !s.name) && can("signatory:manage") && (
                    <Button size="compact-xs" variant="light" mt={4} w="fit-content" onClick={() => setNaming(s)}>Name this signature</Button>
                  )}
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
      {ext.signatories.some((s) => s.source === "unknown") && !can("signatory:manage") && (
        <Text size="xs" c="dimmed">Unnamed signatures are named by a pathologist or an admin (signatory:manage).</Text>
      )}
      <NameSignature lab={ext.lab} labName={ext.labName} signatory={naming} onClose={() => setNaming(null)} />
    </Stack>
  );
}

/** Names a partner signature once, by its image sha; the organisation's open imports carrying it are read again. */
function NameSignature({ lab, labName, signatory, onClose }: { lab: Gql.ExternalLab; labName: string; signatory: Gql.ExternalSignatoryOnReport | null; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm({
    initialValues: { name: "", qualification: "", registration: "", title: "", role: "pathologist" as Gql.ExternalSignatoryRole },
    validate: { name: (v) => (v.trim().length < 2 ? "Write the name as the partner prints it" : null) },
  });
  useEffect(() => {
    if (signatory) form.setValues({ name: signatory.name ?? "", qualification: signatory.qualification ?? "", registration: signatory.registration ?? "", title: signatory.title ?? "", role: signatory.role === "unknown" ? "pathologist" : signatory.role });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatory?.sha]);
  const save = useAction(
    (v: typeof form.values) =>
      mgpl.imports.nameSignature({
        sha: signatory!.sha, lab, name: v.name.trim(), role: v.role,
        ...(v.qualification.trim() ? { qualification: v.qualification.trim() } : {}),
        ...(v.registration.trim() ? { registration: v.registration.trim() } : {}),
        ...(v.title.trim() ? { title: v.title.trim() } : {}),
      }),
    {
      refresh: [["mgpl", "imports"], ["mgpl", "signatories"]],
      success: (r) => `${r.name} saved. Open imports with this signature are read again`,
      onDone: () => {
        onClose();
        // The re-read runs as a job: look again shortly.
        setTimeout(() => qc.invalidateQueries({ queryKey: ["mgpl", "imports"] }), 4000);
      },
    },
  );

  return (
    <Modal opened={!!signatory} onClose={onClose} title={`Name a ${labName} signature`}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">The name is saved once for this signature image and used on every later report from {labName} that carries it. It is never used as our signatory.</Text>
          <TextInput label="Name" placeholder="Dr A. Example" required data-autofocus {...form.getInputProps("name")} />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="Qualification" placeholder="MD (Pathology)" {...form.getInputProps("qualification")} />
            <TextInput label="Registration" placeholder="Council and number" {...form.getInputProps("registration")} />
          </SimpleGrid>
          <TextInput label="Title" placeholder="Consultant pathologist" {...form.getInputProps("title")} />
          <Select label="Role" data={SIGNATORY_ROLES} allowDeselect={false} {...form.getInputProps("role")} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save name</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function RejectImport({ ext }: { ext: Gql.ExternalReport }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reject = useAction((r: string) => mgpl.imports.reject(ext.id, r), {
    refresh: [["mgpl", "imports"]],
    success: "Import rejected. Nothing was written to our reports",
    onDone: () => setOpen(false),
  });
  return (
    <>
      <Group justify="flex-end">
        <Button variant="subtle" color="red" size="xs" onClick={() => setOpen(true)}>Reject this import</Button>
      </Group>
      <Modal opened={open} onClose={() => setOpen(false)} title="Reject this import?">
        <Stack gap="sm">
          <Text size="sm">Nothing is written to our reports. The import stays in the list as rejected.</Text>
          <Textarea label="Reason" placeholder="Wrong patient, unreadable PDF, sent twice…" required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} data-autofocus />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Keep it</Button>
            <Button
              color="red"
              loading={reject.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => reject.mutate(reason.trim())}
            >
              Reject
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
