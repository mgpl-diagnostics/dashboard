"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert, Anchor, Badge, Button, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DownloadSimpleIcon, FileTextIcon, ReceiptIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { documentBlob, openBlob } from "@mgpl-diagnostics/client";
import { date, dateTime, rupees } from "@/lib/format";
import { errorCode, errorMessage, mgpl } from "@/lib/mgpl";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** The patient's page: one booking's bills and released reports, opened from the QR. Read-only. */
export default function PatientPage() {
  const { token = "" } = useParams<{ token: string }>();
  const valid = TOKEN.test(token);
  const q = useQuery({
    queryKey: ["patient-page", token],
    queryFn: () => mgpl.patientLinks.page(token),
    enabled: valid,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function open(kind: "invoice" | "reports", invoiceId?: string) {
    setBusy(invoiceId ?? kind);
    try {
      const doc = await mgpl.patientLinks.document(token, kind, invoiceId);
      if (!doc) throw new Error("This link no longer opens");
      openBlob(documentBlob(doc));
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't open the PDF", message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  if (valid && q.isPending) return <Loader size="sm" />;
  if (q.isError)
    return (
      <Alert color="red" icon={<WarningCircleIcon size={18} />} title="Couldn't load this page">
        {errorCode(q.error) === "RATE_LIMITED" ? "Too many tries from this network. Wait a few minutes and open the link again" : errorMessage(q.error)}
      </Alert>
    );
  const p = q.data;
  if (!valid || !p)
    return (
      <Stack gap="xs">
        <Title order={2}>{"This link doesn't open"}</Title>
        <Text c="dimmed">
          It may have expired or been stopped by the lab. Ask the lab for a new one; the QR on your next printed report or bill works too
        </Text>
      </Stack>
    );

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Title order={2}>{p.patientName}</Title>
        <Text c="dimmed" size="sm">
          {p.labName}, booking <Text span ff="monospace">{p.bookingNo}</Text> of {date(p.bookedAt)}
        </Text>
      </Stack>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={3}>Reports</Title>
            {p.reports.length > 0 && (
              <Button size="compact-sm" leftSection={<DownloadSimpleIcon size={16} />} loading={busy === "reports"} onClick={() => open("reports")}>
                Open PDF
              </Button>
            )}
          </Group>
          {p.reports.length === 0 && <Text size="sm" c="dimmed">No report is ready yet</Text>}
          {p.reports.map((r) => (
            <Group key={r.id} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap"><FileTextIcon size={16} /><Text size="sm">{r.testName}</Text></Group>
              <Text size="xs" c="dimmed" className="figure" style={{ whiteSpace: "nowrap" }}>{dateTime(r.releasedAt)}</Text>
            </Group>
          ))}
          {p.pending.length > 0 && (
            <Text size="sm" c="dimmed">In the lab: {p.pending.join(", ")}</Text>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Title order={3}>Bill</Title>
          {p.invoices.length === 0 && <Text size="sm" c="dimmed">No bill yet</Text>}
          {p.invoices.map((i) => (
            <Group key={i.id} justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Group gap="xs" wrap="nowrap"><ReceiptIcon size={16} /><Text size="sm" ff="monospace">{i.invoiceNo}</Text></Group>
                <Text size="xs" c={i.duePaise > 0 ? "red" : "dimmed"} className="figure">
                  {rupees(i.totalPaise)}{i.duePaise > 0 ? `, ${rupees(i.duePaise)} due` : ", paid"}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Badge variant="light" color={i.duePaise > 0 ? "orange" : "tulsi"}>{i.duePaise > 0 ? "Due" : "Paid"}</Badge>
                <Button size="compact-sm" variant="light" loading={busy === i.id} onClick={() => open("invoice", i.id)}>Open</Button>
              </Group>
            </Group>
          ))}
        </Stack>
      </Card>

      <Stack gap={2}>
        <Text size="sm" fw={500}>{p.branch.name}</Text>
        {p.branch.address && <Text size="sm" c="dimmed">{p.branch.address}</Text>}
        {p.branch.phone && <Text size="sm" c="dimmed">Phone <Anchor href={`tel:${p.branch.phone}`} inherit>{p.branch.phone}</Anchor></Text>}
        <Text size="xs" c="dimmed">This link works until {date(p.expiresAt)}</Text>
      </Stack>
    </Stack>
  );
}
