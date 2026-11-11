"use client";
import { useState } from "react";
import { ActionIcon, Button, CopyButton, Group, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { CheckIcon, CopyIcon, LinkIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { date } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

/**
 * The booking's patient link: the page the QR on its reports and bills opens (the bill and released reports only).
 * Staff show or send it; "Stop link" makes every printed QR of the booking stop opening.
 */
export function PatientLink({ booking }: { booking: Pick<Gql.Booking, "id" | "bookingNo" | "status"> }) {
  const { can } = useViewer();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const show = useAction((id: string) => mgpl.patientLinks.forBooking(id), { onDone: (l) => setLink(l) });
  const stop = useAction((id: string) => mgpl.patientLinks.revoke(id), {
    success: (n) => (n ? "Link stopped. The next print makes a new one" : "There was no link to stop"),
    onDone: () => setLink(null),
  });
  if (booking.status === "cancelled" || !can("booking:read") || !can("report:read")) return null;

  return (
    <Stack gap="xs">
      <Title order={3}>Patient link</Title>
      <Text size="sm" c="dimmed">The QR on the reports and the bill opens this page: the bill and the released reports, nothing else</Text>
      {link ? (
        <Stack gap={6}>
          <TextInput
            readOnly
            value={link.url}
            aria-label="Patient link"
            styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
            onFocus={(e) => e.currentTarget.select()}
            rightSection={
              <CopyButton value={link.url} timeout={1500}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                    <ActionIcon variant="subtle" onClick={copy} aria-label="Copy the link">{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}</ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            }
          />
          <Text size="xs" c="dimmed">Works until {date(link.expiresAt)}</Text>
        </Stack>
      ) : null}
      <Group gap="xs">
        {!link && (
          <Button variant="light" leftSection={<LinkIcon size={16} />} loading={show.isPending} onClick={() => show.mutate(booking.id)}>
            Show patient link
          </Button>
        )}
        {can("booking:update") && (
          <Button
            variant="subtle"
            color="red"
            loading={stop.isPending}
            onClick={() =>
              modals.openConfirmModal({
                title: `Stop the patient link of ${booking.bookingNo}?`,
                children: <Text size="sm">The QR on every printed report and bill of this booking stops opening. The next print carries a new link.</Text>,
                labels: { confirm: "Stop link", cancel: "Keep it" },
                confirmProps: { color: "red" },
                onConfirm: () => stop.mutate(booking.id),
              })
            }
          >
            Stop link
          </Button>
        )}
      </Group>
    </Stack>
  );
}
