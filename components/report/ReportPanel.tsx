"use client";
import { useState } from "react";
import { Badge, Button, Card, Drawer, Group, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { FilePdfIcon } from "@phosphor-icons/react";
import { documentBlob, openBlob, type Gql } from "@mgpl-diagnostics/client";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { TubeCap } from "@/components/TubeCap";
import { dateTime } from "@/lib/format";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { useAction, useBooking } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";
import { reports } from "@/lib/reports";
import { notifications } from "@mantine/notifications";
import { FlagBadge, ResultsForm } from "./ResultsForm";

/** A booking's tests and their reports: start, enter, verify, release, amend, print. */
export function ReportPanel({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const { can } = useViewer();
  const booking = useBooking(bookingId);
  const b = booking.data;
  const patient = useQuery({ queryKey: ["mgpl", "patients", "one", b?.patient.id], queryFn: () => mgpl.patients.get(b!.patient.id), enabled: !!b && can("patient:read") });
  const [printing, setPrinting] = useState(false);

  async function print() {
    if (!b) return;
    setPrinting(true);
    try {
      openBlob(documentBlob(await mgpl.documents.bookingReports(b.id, { format: "pdf" })));
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't print", message: errorMessage(err) });
    } finally {
      setPrinting(false);
    }
  }

  const printable = b?.reports.some((r) => r.status === "verified" || r.status === "released");

  return (
    <Drawer opened={!!bookingId} onClose={onClose} size="xl" title={b ? `${b.patient.name} · ${b.bookingNo}` : "Reports"}>
      {booking.isPending && bookingId && <Loader size="sm" />}
      {booking.isError && <QueryError error={booking.error} />}
      {b && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {patient.data ? `${patient.data.sex === "female" ? "Female" : patient.data.sex === "male" ? "Male" : "Other"}${patient.data.ageYears != null ? `, ${patient.data.ageYears} y` : ""} · ` : ""}
              booked {dateTime(b.createdAt)}
            </Text>
            {printable && (
              <Button variant="light" size="xs" leftSection={<FilePdfIcon size={16} />} loading={printing} onClick={print}>
                Open PDF
              </Button>
            )}
          </Group>
          {b.tests.map((t) => (
            <TestReport key={t.testCode} booking={b} test={t} report={b.reports.find((r) => r.testCode === t.testCode)} sex={patient.data?.sex} />
          ))}
        </Stack>
      )}
    </Drawer>
  );
}

function TestReport({ booking, test, report, sex }: { booking: Gql.Booking; test: Gql.BookingTest; report?: Gql.Booking["reports"][number]; sex?: Gql.Sex }) {
  const { can } = useViewer();
  const [editing, setEditing] = useState(false);
  const full = useQuery({ queryKey: ["mgpl", "reports", report?.id], queryFn: () => reports.get(report!.id), enabled: !!report });
  const refresh = [["mgpl", "bookings"], ["mgpl", "reports"]];
  const start = useAction(() => reports.create(booking.id, test.testCode, test.name), { refresh, onDone: () => setEditing(true) });
  const verify = useAction((id: string) => reports.verify(id), { success: `${test.name} verified`, refresh });
  const release = useAction((id: string) => reports.release(id), { success: `${test.name} released to the patient`, refresh });
  const amend = useAction((id: string) => reports.amend(id), { success: "Opened for amendment. Enter the corrected results", refresh, onDone: () => setEditing(true) });
  const r = full.data;
  const sampleReady = booking.samples.some((s) => s.sampleType === test.sampleType && s.status === "received") || !test.sampleType;
  const editable = r && (r.status === "draft" || r.status === "entered" || r.status === "amended");

  return (
    <Card padding="md">
      <Group justify="space-between" mb={r?.results.length || editing ? "sm" : 0} wrap="nowrap">
        <Stack gap={2} miw={0}>
          <Title order={3} lineClamp={1}>{test.name}</Title>
          <Group gap="xs">
            <TubeCap sampleType={test.sampleType} />
          </Group>
        </Stack>
        <Group gap={6} wrap="nowrap">
          {report ? <StatusBadge status={report.status} /> : <Badge color="gray">Not started</Badge>}
        </Group>
      </Group>

      {r && r.results.length > 0 && !editing && (
        <Table.ScrollContainer minWidth={420}>
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {r.results.map((v) => (
                <Table.Tr key={v.parameter}>
                  <Table.Td><Text size="sm">{v.parameter}</Text></Table.Td>
                  <Table.Td><Group gap={6} wrap="nowrap"><Text size="sm" ff="monospace" fw={v.flag && v.flag !== "NONE" ? 600 : 400}>{v.value}</Text><Text size="xs" c="dimmed">{v.unit ?? ""}</Text></Group></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{v.range ?? ""}</Text></Table.Td>
                  <Table.Td ta="right"><FlagBadge flag={v.flag} /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {editing && r && <ResultsForm report={r} sex={sex} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />}

      <Group gap="xs" mt="sm" justify="flex-end">
        {!report && can("report:enter") && (
          <Button size="xs" loading={start.isPending} disabled={!sampleReady} title={sampleReady ? undefined : "Receive the sample at the lab first"} onClick={() => start.mutate(undefined)}>
            {sampleReady ? "Enter results" : "Waiting for the sample"}
          </Button>
        )}
        {editable && can("report:enter") && !editing && <Button size="xs" variant="light" onClick={() => setEditing(true)}>{r.results.length ? "Edit results" : "Enter results"}</Button>}
        {r?.status === "entered" && can("report:verify") && !editing && <Button size="xs" loading={verify.isPending} onClick={() => verify.mutate(r.id)}>Verify</Button>}
        {r?.status === "verified" && can("report:release") && (
          <Button size="xs" color="tulsi" loading={release.isPending} onClick={() => release.mutate(r.id)}>Release</Button>
        )}
        {(r?.status === "verified" || r?.status === "released") && can("report:amend") && (
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() =>
              modals.openConfirmModal({
                title: `Amend ${test.name}?`,
                children: <Text size="sm">The report goes back for correction and must be verified and released again. The current version stays in the history.</Text>,
                labels: { confirm: "Amend", cancel: "Keep it" },
                onConfirm: () => amend.mutate(r.id),
              })
            }
          >
            Amend
          </Button>
        )}
      </Group>
      {r?.verifiedAt && <Text size="xs" c="dimmed" mt={6}>Verified {dateTime(r.verifiedAt)}{r.releasedAt ? ` · released ${dateTime(r.releasedAt)}` : ""}</Text>}
    </Card>
  );
}
